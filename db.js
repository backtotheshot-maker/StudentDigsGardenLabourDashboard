import { client } from './supabaseClient.js';
import { CITY_RATE_FALLBACK } from './config.js';
import { timeToHours } from './utils.js';

// ---- reads ----------------------------------------------------------------

export async function fetchAll() {
  const [employees, clients, jobs, cityRates, settingsRows, payments] = await Promise.all([
    client.from('employees').select('*').order('name'),
    client.from('clients').select('*').order('name'),
    client.from('jobs').select('*').order('date', { ascending: false }),
    client.from('city_rates').select('*'),
    client.from('business_settings').select('*').eq('id', 1).maybeSingle(),
    client.from('payments').select('*'),
  ]);
  for (const r of [employees, clients, jobs, cityRates, payments]) {
    if (r.error) throw r.error;
  }
  if (settingsRows.error) throw settingsRows.error;

  const cityRateMap = {};
  for (const row of cityRates.data || []) cityRateMap[row.city] = Number(row.hourly_charge);

  return {
    employees: employees.data || [],
    clients: clients.data || [],
    jobs: jobs.data || [],
    cityRateMap,
    settings: settingsRows.data || {},
    payments: payments.data || [],
  };
}

// ---- money rules ------------------------------------------------------------

export function cityRate(cityRateMap, city) {
  return cityRateMap[city] ?? CITY_RATE_FALLBACK;
}

export function computeJobMoney(job, employee, cityRateMap, settings) {
  const h = jobHours(job);
  const rate = Number(employee?.hourly_rate || 0);
  const cRate = cityRate(cityRateMap, employee?.city);
  const gwPay = Number(settings.green_waste_pay ?? 8);
  const gwCharge = Number(settings.green_waste_charge ?? 10);
  const pay = job.pay_amount != null ? Number(job.pay_amount) : h * rate + (job.green_waste ? gwPay : 0);
  const billed = job.client_charge != null ? Number(job.client_charge) : h * cRate + (job.green_waste ? gwCharge : 0);
  return { hours: h, pay, billed };
}

export function jobHours(job) {
  return timeToHours(job.start_time, job.end_time);
}

// ---- mutations --------------------------------------------------------------

export async function markJobDone(job, employee, cityRateMap, settings) {
  const { hours: h, pay, billed } = computeJobMoney(job, employee, cityRateMap, settings);
  const { error } = await client
    .from('jobs')
    .update({ status: 'done', pay_amount: pay, client_charge: billed })
    .eq('id', job.id);
  if (error) throw error;
}

export async function setReview(jobId, review_status) {
  const { error } = await client.from('jobs').update({ review_status }).eq('id', jobId);
  if (error) throw error;
}

export async function confirmAll(jobIds) {
  if (!jobIds.length) return;
  const { error } = await client.from('jobs').update({ review_status: 'confirmed' }).in('id', jobIds);
  if (error) throw error;
}

export async function nudgeHandover(clientId) {
  const { error } = await client.from('clients').update({ last_nudged_at: new Date().toISOString() }).eq('id', clientId);
  if (error) throw error;
}

export async function changeRate(employeeId, newRate) {
  const { error } = await client.from('employees').update({ hourly_rate: newRate }).eq('id', employeeId);
  if (error) throw error;
}

// Sends a payment run: one `payments` row per student covering their confirmed,
// unpaid jobs, then flips those jobs to paid and links them to the new payment row.
// NOTE: there is no live bank/Starling integration here — this records that the
// run happened and settles the jobs; moving the actual money is still a manual
// step (or a future integration) outside this app.
export async function sendPaymentRun(rows, reference) {
  const today = new Date().toISOString().slice(0, 10);
  const results = [];
  for (const row of rows) {
    const { data: payment, error: payErr } = await client
      .from('payments')
      .insert({
        employee_id: row.employeeId,
        week_start_date: today,
        week_end_date: today,
        amount_due: row.pay,
        status: 'paid',
        paid_at: new Date().toISOString(),
        top_up: row.topUp || 0,
        reference,
      })
      .select()
      .single();
    if (payErr) throw payErr;
    const { error: jobsErr } = await client
      .from('jobs')
      .update({ status: 'paid', payment_id: payment.id })
      .in('id', row.jobIds);
    if (jobsErr) throw jobsErr;
    results.push(payment);
  }
  return results;
}
