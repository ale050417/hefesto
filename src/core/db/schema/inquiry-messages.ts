import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { inquiries } from "./inquiries";
import { profiles } from "./profiles";

// Chat dentro de cada consulta (0086, pedido de Ale 2026-11-25): la vendedora
// y el operador conversan ahí (texto y fotos) hasta definir el pedido.
export const inquiryMessages = pgTable(
  "inquiry_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    // Snapshot: el mensaje se entiende aunque la cuenta se borre.
    authorName: text("author_name"),
    body: text("body").notNull().default(""),
    // Foto del mensaje (bucket de imágenes, prefijo consultas/<id>/chat/).
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("inquiry_messages_inquiry_idx").on(t.inquiryId, t.createdAt)],
);

// Hasta cuándo leyó cada persona cada conversación (mensajes sin leer).
export const inquiryReads = pgTable(
  "inquiry_reads",
  {
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: "inquiry_reads_pk",
      columns: [t.inquiryId, t.profileId],
    }),
  ],
);
