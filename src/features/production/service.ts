import * as repo from "./repository";

export async function getBoard() {
  const [printers, jobs] = await Promise.all([
    repo.listPrinters(),
    repo.listJobs(),
  ]);
  return { printers, jobs };
}

export const createPrinter = repo.createPrinter;
export const setPrinterStatus = repo.setPrinterStatus;
export const createJob = repo.createJob;
export const setJobStatus = repo.setJobStatus;
