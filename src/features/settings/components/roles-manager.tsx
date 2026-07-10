"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/stores/toastStore";
import {
  assignMemberRoleAction,
  createRoleAction,
  deleteRoleAction,
  inviteTeamMemberAction,
  removeTeamMemberAction,
  resendInviteAction,
  updateRoleAction,
} from "../actions";
import { PERM_ACTIONS, PERM_MODULES } from "@/core/auth/perm-defs";
import type { Role, TeamMember } from "../types";
import { runAction } from "@/lib/run-action";
import { useDeleteResource } from "@/hooks/use-delete-resource";

/* ---------- íconos inline ---------- */
const ic = (path: string) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    dangerouslySetInnerHTML={{ __html: path }}
  />
);
const I = {
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  trash:
    '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
};

type Credentials = { email: string; password: string };

function roleAllows(role: Role, moduleId: string, action: string): boolean {
  if (role.isAdmin) return true;
  return (role.permissions[moduleId] ?? []).includes(action);
}

export function RolesManager({
  team,
  roles,
  canManage,
  currentUserId,
}: {
  team: TeamMember[];
  roles: Role[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleModal, setRoleModal] = useState<Role | "new" | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);

  const activos = team.filter((t) => t.status === "activo").length;
  const pendientes = team.filter((t) => t.status === "invitado").length;
  const adminCount = team.filter((t) => t.role === "admin").length;

  async function assign(userId: string, roleId: string) {
    setPendingId(userId);
    const res = await runAction(
      () => assignMemberRoleAction({ userId, roleId }),
      { silent: true },
    );
    setPendingId(null);
    if (res.ok) {
      toast("Rol actualizado", "success");
    } else toast(res.error.message, "danger");
  }

  async function resend(userId: string) {
    setPendingId(userId);
    const res = await runAction(() => resendInviteAction({ userId }), {
      silent: true,
    });
    setPendingId(null);
    if (res.ok) {
      setCreds(res.data);
    } else toast(res.error.message, "danger");
  }

  // Patrón único de eliminación (modo toast: los confirms son modales propios).
  const { deleteResource: removeMember } = useDeleteResource({
    action: (userId: string) => removeTeamMemberAction({ userId }),
    successMessage: "Acceso revocado",
    notify: "toast",
    label: "Quitando acceso…",
    onDeleted: () => setRemoveTarget(null),
  });
  const { deleteResource: removeRole } = useDeleteResource({
    action: (roleId: string) => deleteRoleAction({ id: roleId }),
    successMessage: "Rol eliminado",
    notify: "toast",
    label: "Eliminando rol…",
    onDeleted: () => setDeleteRole(null),
  });

  async function confirmRemove() {
    if (!removeTarget) return;
    await removeMember(removeTarget.id);
  }

  async function confirmDeleteRole() {
    if (!deleteRole) return;
    await removeRole(deleteRole.id);
  }

  const roleMemberCount = (roleId: string) =>
    team.filter((t) => t.roleId === roleId).length;

  return (
    <div className="grid gap-5">
      {/* ===== EQUIPO ===== */}
      <div className="ui-card section-card">
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 16 }}
        >
          <div>
            <div className="section-title">Equipo de gestión</div>
            <div
              className="text-faint"
              style={{ fontSize: "12.5px", marginTop: 3 }}
            >
              Personas con acceso al panel · {activos} activos · {pendientes}{" "}
              {pendientes === 1
                ? "invitación pendiente"
                : "invitaciones pendientes"}
            </div>
          </div>
          {canManage ? (
            <Button type="button" onClick={() => setInviteOpen(true)}>
              {ic(I.send)}Invitar miembro
            </Button>
          ) : null}
        </div>

        <div className="table-wrap" style={{ border: "none" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Miembro</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {team.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-faint"
                    style={{ textAlign: "center", padding: 20 }}
                  >
                    Todavía no hay miembros en el equipo.
                  </td>
                </tr>
              ) : (
                team.map((t) => {
                  const isSelf = t.id === currentUserId;
                  const isLastAdmin = t.role === "admin" && adminCount <= 1;
                  const editable = canManage && !isSelf && !isLastAdmin;
                  return (
                    <tr key={t.id} style={{ cursor: "default" }}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span
                            className="avatar"
                            style={{ width: 34, height: 34, fontSize: 13 }}
                          >
                            {(
                              t.fullName?.[0] ??
                              t.email?.[0] ??
                              "?"
                            ).toUpperCase()}
                          </span>
                          <b>
                            {t.fullName ?? "Sin nombre"}
                            {isSelf ? " (vos)" : ""}
                          </b>
                        </div>
                      </td>
                      <td className="muted">{t.email ?? "—"}</td>
                      <td>
                        {editable ? (
                          <select
                            className="select"
                            style={{
                              width: "auto",
                              padding: "6px 26px 6px 9px",
                              fontSize: "12.5px",
                            }}
                            value={t.roleId ?? ""}
                            disabled={pendingId === t.id}
                            onChange={(e) => assign(t.id, e.target.value)}
                          >
                            {t.roleId ? null : (
                              <option value="">— Sin rol —</option>
                            )}
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge
                            variant={t.role === "admin" ? "gold" : "neutral"}
                          >
                            {t.roleName ??
                              (t.role === "admin"
                                ? "Administrador"
                                : "Operador")}
                          </Badge>
                        )}
                      </td>
                      <td>
                        {t.status === "activo" ? (
                          <Badge variant="success">Activo</Badge>
                        ) : (
                          <Badge variant="warning">Invitación pendiente</Badge>
                        )}
                      </td>
                      <td>
                        <div
                          className="flex items-center gap-2"
                          style={{ justifyContent: "flex-end" }}
                        >
                          {t.status === "invitado" && canManage ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={pendingId === t.id}
                              onClick={() => resend(t.id)}
                              title="Generar nueva contraseña temporal"
                            >
                              {ic(I.key)}Nueva clave
                            </button>
                          ) : null}
                          {canManage && !isSelf && !isLastAdmin ? (
                            <button
                              type="button"
                              className="btn-icon btn-ghost"
                              title="Quitar acceso"
                              aria-label="Quitar acceso"
                              onClick={() => setRemoveTarget(t)}
                            >
                              {ic(I.trash)}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== ROLES Y PERMISOS ===== */}
      <div className="flex items-center justify-between">
        <div>
          <div className="section-title">Roles y permisos</div>
          <div
            className="text-faint"
            style={{ fontSize: "12.5px", marginTop: 3 }}
          >
            Definí qué puede hacer cada rol
          </div>
        </div>
        {canManage ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRoleModal("new")}
          >
            {ic(I.plus)} Nuevo rol
          </button>
        ) : null}
      </div>

      {roles.map((r) => (
        <div key={r.id} className="ui-card section-card">
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 16 }}
          >
            <div className="flex items-center gap-3">
              <div className="kpi-ic">{ic(I.shield)}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{r.name}</div>
                <div className="text-faint" style={{ fontSize: 12 }}>
                  {roleMemberCount(r.id)}{" "}
                  {roleMemberCount(r.id) === 1 ? "usuario" : "usuarios"}
                  {r.isSystem ? " · rol de sistema" : ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {r.isAdmin ? <Badge variant="gold">Acceso total</Badge> : null}
              {canManage && !r.isAdmin ? (
                <button
                  type="button"
                  className="btn-icon btn-ghost"
                  title="Editar permisos"
                  aria-label="Editar permisos"
                  onClick={() => setRoleModal(r)}
                >
                  {ic(I.edit)}
                </button>
              ) : null}
              {canManage && !r.isSystem ? (
                <button
                  type="button"
                  className="btn-icon btn-ghost"
                  title="Borrar rol"
                  aria-label="Borrar rol"
                  onClick={() => setDeleteRole(r)}
                >
                  {ic(I.trash)}
                </button>
              ) : null}
            </div>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Módulo</th>
                  {PERM_ACTIONS.map((a) => (
                    <th
                      key={a}
                      style={{
                        textAlign: "center",
                        textTransform: "capitalize",
                      }}
                    >
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERM_MODULES.map(([mid, ml]) => (
                  <tr key={mid} style={{ cursor: "default" }}>
                    <td>
                      <b style={{ fontWeight: 500 }}>{ml}</b>
                    </td>
                    {PERM_ACTIONS.map((a) => {
                      const on = roleAllows(r, mid, a);
                      return (
                        <td key={a} style={{ textAlign: "center" }}>
                          <div
                            className={`check${on ? "on" : ""}`}
                            style={{ margin: "0 auto" }}
                          >
                            {ic(I.check)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {inviteOpen ? (
        <InviteModal
          roles={roles}
          onClose={() => setInviteOpen(false)}
          onCreated={(c) => {
            setInviteOpen(false);
            setCreds(c);
          }}
        />
      ) : null}

      {creds ? (
        <CredentialsModal creds={creds} onClose={() => setCreds(null)} />
      ) : null}

      {roleModal ? (
        <RoleModal
          role={roleModal === "new" ? null : roleModal}
          onClose={() => setRoleModal(null)}
          onDone={() => {
            setRoleModal(null);
          }}
        />
      ) : null}

      {removeTarget ? (
        <Modal
          open
          onClose={() => setRemoveTarget(null)}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRemoveTarget(null)}
              >
                Cancelar
              </Button>
              <Button type="button" variant="danger" onClick={confirmRemove}>
                Quitar acceso
              </Button>
            </>
          }
        >
          <div style={{ textAlign: "center", padding: "8px 4px" }}>
            <div
              className="kpi-ic"
              style={{
                width: 54,
                height: 54,
                margin: "0 auto 16px",
                background: "rgba(217,106,90,.12)",
                color: "var(--danger)",
              }}
            >
              {ic(I.logout)}
            </div>
            <div className="section-title" style={{ marginBottom: 8 }}>
              ¿Quitar acceso a {removeTarget.fullName ?? removeTarget.email}?
            </div>
            <div
              className="muted"
              style={{ fontSize: 13.5, maxWidth: 340, margin: "0 auto" }}
            >
              No podrá volver a iniciar sesión en el panel. Su cuenta se
              mantiene como cliente; podés volver a invitarlo cuando quieras.
            </div>
          </div>
        </Modal>
      ) : null}

      {deleteRole ? (
        <Modal
          open
          onClose={() => setDeleteRole(null)}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteRole(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={pendingId === deleteRole.id}
                onClick={confirmDeleteRole}
              >
                Borrar rol
              </Button>
            </>
          }
        >
          <div style={{ textAlign: "center", padding: "8px 4px" }}>
            <div
              className="kpi-ic"
              style={{
                width: 54,
                height: 54,
                margin: "0 auto 16px",
                background: "rgba(217,106,90,.12)",
                color: "var(--danger)",
              }}
            >
              {ic(I.trash)}
            </div>
            <div className="section-title" style={{ marginBottom: 8 }}>
              ¿Borrar el rol “{deleteRole.name}”?
            </div>
            <div
              className="muted"
              style={{ fontSize: 13.5, maxWidth: 340, margin: "0 auto" }}
            >
              Solo se puede borrar si no hay nadie con este rol asignado.
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/* ---------- Modal invitar (contraseña temporal) ---------- */
function InviteModal({
  roles,
  onClose,
  onCreated,
}: {
  roles: Role[];
  onClose: () => void;
  onCreated: (creds: Credentials) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(
    roles.find((r) => !r.isAdmin)?.id ?? roles[0]?.id ?? "",
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    if (!email.trim()) return setErr("Ingresá el email de la persona.");
    if (!/.+@.+\..+/.test(email)) return setErr("Ingresá un email válido.");
    if (!roleId) return setErr("Elegí un rol.");
    setBusy(true);
    const res = await runAction(
      () => inviteTeamMemberAction({ fullName, email, roleId }),
      { silent: true },
    );
    setBusy(false);
    if (!res.ok) return setErr(res.error.message);
    onCreated(res.data);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Invitar miembro"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} loading={busy}>
            {busy ? "Creando…" : "Crear acceso"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="text-faint" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Se crea el acceso con una <b>contraseña temporal</b> que vas a ver al
          confirmar. Pasásela a la persona por un canal seguro; deberá cambiarla
          en su primer ingreso.
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Nombre completo</label>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Carla Videla"
            />
          </div>
          <div className="field">
            <label>Rol</label>
            <select
              className="select"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@email.com"
          />
        </div>
        {err ? (
          <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
            {err}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/* ---------- Modal credenciales ---------- */
function CredentialsModal({
  creds,
  onClose,
}: {
  creds: Credentials;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const txt = `Hefesto 3D — acceso al panel\nUsuario: ${creds.email}\nContraseña temporal: ${creds.password}`;
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      toast("Credenciales copiadas", "success");
    } catch {
      toast("No se pudo copiar", "danger");
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Credenciales de acceso"
      footer={
        <Button type="button" onClick={onClose}>
          {ic(I.check)}Listo
        </Button>
      }
    >
      <div className="grid gap-4">
        <div
          className="ui-card"
          style={{
            padding: 16,
            background:
              "linear-gradient(150deg,rgba(var(--gold-rgb),.07),transparent)",
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{ color: "var(--gold-bright)", marginBottom: 12 }}
          >
            {ic(I.key)}
            <b style={{ fontSize: 13 }}>Datos de ingreso</b>
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Usuario</label>
            <input
              className="input"
              readOnly
              value={creds.email}
              style={{ fontFamily: "var(--font-display)", fontSize: 12.5 }}
            />
          </div>
          <div className="field">
            <label>Contraseña temporal</label>
            <input
              className="input"
              readOnly
              value={creds.password}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                letterSpacing: ".03em",
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 12 }}
            onClick={copy}
          >
            {ic(I.copy)}
            {copied ? "Copiado" : "Copiar credenciales"}
          </button>
        </div>
        <div className="text-faint" style={{ fontSize: 12, lineHeight: 1.5 }}>
          Guardala ahora: por seguridad no se vuelve a mostrar. La persona
          deberá cambiarla en su primer ingreso. Le avisamos por email que tiene
          acceso (sin la contraseña).
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Modal crear / editar rol ---------- */
function RoleModal({
  role,
  onClose,
  onDone,
}: {
  role: Role | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [perms, setPerms] = useState<Record<string, string[]>>(
    role?.permissions ?? {},
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const has = (m: string, a: string) => (perms[m] ?? []).includes(a);
  const toggle = (m: string, a: string) =>
    setPerms((p) => {
      const cur = new Set(p[m] ?? []);
      if (cur.has(a)) cur.delete(a);
      else cur.add(a);
      return { ...p, [m]: [...cur] };
    });

  async function submit() {
    setErr(null);
    if (!name.trim()) return setErr("Ingresá un nombre para el rol.");
    setBusy(true);
    const clean: Record<string, string[]> = {};
    for (const [m, a] of Object.entries(perms)) if (a.length) clean[m] = a;
    const res = role
      ? await runAction(
          () => updateRoleAction({ id: role.id, name, permissions: clean }),
          { silent: true },
        )
      : await runAction(() => createRoleAction({ name, permissions: clean }), {
          silent: true,
        });
    setBusy(false);
    if (!res.ok) return setErr(res.error.message);
    toast(role ? "Rol actualizado" : "Rol creado", "success");
    onDone();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={role ? `Editar rol` : "Nuevo rol"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={busy}>
            {busy ? "Guardando…" : role ? "Guardar cambios" : "Crear rol"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="field">
          <label>Nombre del rol</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Atención al cliente"
          />
        </div>
        <div className="field">
          <label>Permisos por módulo</label>
          {/* Scroll propio: con muchos módulos, todas las filas quedan accesibles. */}
          <div
            className="table-wrap"
            style={{ maxHeight: "46vh", overflowY: "auto" }}
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th>Módulo</th>
                  {PERM_ACTIONS.map((a) => (
                    <th
                      key={a}
                      style={{
                        textAlign: "center",
                        textTransform: "capitalize",
                      }}
                    >
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERM_MODULES.map(([mid, ml]) => (
                  <tr key={mid} style={{ cursor: "default" }}>
                    <td>
                      <button
                        type="button"
                        onClick={() => toggle(mid, "ver")}
                        title="Marcar/desmarcar ver"
                        style={{
                          background: "none",
                          border: 0,
                          padding: 0,
                          font: "inherit",
                          color: "inherit",
                          cursor: "pointer",
                          textAlign: "left",
                          fontWeight: 500,
                        }}
                      >
                        {ml}
                      </button>
                    </td>
                    {PERM_ACTIONS.map((a) => {
                      const on = has(mid, a);
                      return (
                        // Toda la celda es clickeable (área grande, fácil de tocar).
                        <td
                          key={a}
                          style={{
                            textAlign: "center",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={() => toggle(mid, a)}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              toggle(mid, a);
                            }
                          }}
                          tabIndex={0}
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`${ml}: ${a}`}
                        >
                          <span
                            className={`check${on ? "on" : ""}`}
                            style={{ margin: "0 auto" }}
                            aria-hidden
                          >
                            {ic(I.check)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {err ? (
          <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
            {err}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
