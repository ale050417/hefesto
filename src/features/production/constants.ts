export const PRINTER_STATUS_LABEL = {
  idle: "Libre",
  printing: "Imprimiendo",
  maintenance: "Mantenimiento",
  offline: "Apagada",
} as const;

export const PRINTER_STATUS_VARIANT = {
  idle: "success",
  printing: "info",
  maintenance: "warning",
  offline: "neutral",
} as const;

export const JOB_STATUS_LABEL = {
  queued: "En cola",
  printing: "Imprimiendo",
  done: "Terminado",
  failed: "Fallido",
} as const;

export const JOB_STATUS_VARIANT = {
  queued: "neutral",
  printing: "info",
  done: "success",
  failed: "danger",
} as const;
