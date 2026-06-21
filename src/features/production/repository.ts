import { desc, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { printJobs, printers } from "@/core/db/schema";

export type Printer = typeof printers.$inferSelect;
export type PrintJob = typeof printJobs.$inferSelect;
export type PrinterStatus = Printer["status"];
export type JobStatus = PrintJob["status"];

export async function listPrinters(): Promise<Printer[]> {
  return db.select().from(printers).orderBy(printers.name);
}

export async function createPrinter(values: {
  name: string;
  model: string | null;
}): Promise<void> {
  await db.insert(printers).values(values);
}

export async function setPrinterStatus(
  id: string,
  status: PrinterStatus,
): Promise<void> {
  await db.update(printers).set({ status }).where(eq(printers.id, id));
}

export type JobRow = PrintJob & { printerName: string | null };

export async function listJobs(): Promise<JobRow[]> {
  const rows = await db
    .select({
      id: printJobs.id,
      printerId: printJobs.printerId,
      orderId: printJobs.orderId,
      title: printJobs.title,
      status: printJobs.status,
      notes: printJobs.notes,
      createdAt: printJobs.createdAt,
      updatedAt: printJobs.updatedAt,
      printerName: printers.name,
    })
    .from(printJobs)
    .leftJoin(printers, eq(printJobs.printerId, printers.id))
    .orderBy(desc(printJobs.createdAt))
    .limit(100);
  return rows;
}

export async function createJob(values: {
  title: string;
  printerId: string | null;
}): Promise<void> {
  await db.insert(printJobs).values(values);
}

export async function setJobStatus(
  id: string,
  status: JobStatus,
): Promise<void> {
  await db.update(printJobs).set({ status }).where(eq(printJobs.id, id));
}
