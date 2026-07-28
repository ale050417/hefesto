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
import { useFormErrors } from "@/hooks/use-form-errors";

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
      toast(`Invitación reenviada a ${res.data.email}`, "success");
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
          <table className="tbl tbl-cards">
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
                      <td data-label="Miembro">
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
                      <td className="muted" data-label="Email">
                        {t.email ?? "—"}
                      </td>
                      <td data-label="Rol">
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
                      <td data-label="Estado">
                        {t.status === "activo" ? (
                          <Badge variant="success">Activo</Badge>
                        ) : (
                          <Badge variant="warning">Invitación pendiente</Badge>
                        )}
                      </td>
                      <td data-label="">
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
                              title="Enviar un link nuevo de un solo uso (el anterior deja de servir)"
                            >
                              {ic(I.send)}Reenviar invitación
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
                            className={`check ${on ? "on" : ""}`}
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
        <InviteModal roles={roles} onClose={() => setInviteOpen(false)} />
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

/* ---------- Modal invitar (link seguro por correo, 2026-07-24) ---------- */
/** Plantilla del mensaje según el rol elegido (editable antes de enviar). */
function inviteTemplate(roleName: string): string {
  return `¡Hola! Te sumo al equipo de Hefesto 3D como ${roleName}. Tocá el botón de abajo para crear tu contraseña y entrar al panel. ¡Bienvenido/a!`;
}

function InviteModal({
  roles,
  onClose,
}: {
  roles: Role[];
  onClose: () => void;
}) {
  const firstRole = roles.find((r) => !r.isAdmin)?.id ?? roles[0]?.id ?? "";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(firstRole);
  // El mensaje arranca con la plantilla del rol y se actualiza al cambiar de
  // rol SOLO si el admin todavía no lo tocó a mano.
  const [message, setMessage] = useState(() => {
    const r = roles.find((x) => x.id === firstRole);
    return r ? inviteTemplate(r.name) : "";
  });
  const [messageTouched, setMessageTouched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fe = useFormErrors();

  function pickRole(id: string) {
    setRoleId(id);
    if (!messageTouched) {
      const r = roles.find((x) => x.id === id);
      if (r) setMessage(inviteTemplate(r.name));
    }
  }

  async function submit() {
    setErr(null);
    const ok = fe.check({
      email: !email.trim()
        ? "Ingresá el email de la persona."
        : !/.+@.+\..+/.test(email)
          ? "Ingresá un email válido."
          : null,
      roleId: !roleId ? "Elegí un rol." : null,
    });
    if (!ok) return;
    setBusy(true);
    const res = await runAction(
      () => inviteTeamMemberAction({ fullName, email, roleId, message }),
      { silent: true },
    );
    setBusy(false);
    if (!res.ok) return fe.fromAction(res.error);
    toast(
      res.data.promoted
        ? `${res.data.email} ya tenía cuenta: quedó promovido al equipo (le avisamos por correo).`
        : `Invitación enviada a ${res.data.email}`,
      "success",
    );
    onClose();
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
            {ic(I.send)}Enviar invitación
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="text-faint" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Le enviamos un correo con un <b>link seguro de un solo uso</b>: al
          tocarlo crea su propia contraseña (nadie más la conoce) y entra al
          panel con el rol elegido. Si el email ya es cliente de la tienda, se
          lo promueve al equipo con su cuenta de siempre.
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
          <div className={`field ${fe.errors.roleId ? "invalid" : ""}`}>
            <label>Rol</label>
            <select
              className="select"
              aria-invalid={!!fe.errors.roleId}
              value={roleId}
              onChange={(e) => pickRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {fe.errors.roleId ? (
              <p className="field-error">{fe.errors.roleId}</p>
            ) : null}
          </div>
        </div>
        <div className={`field ${fe.errors.email ? "invalid" : ""}`}>
          <label>Email</label>
          <input
            className="input"
            type="email"
            aria-invalid={!!fe.errors.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@email.com"
          />
          {fe.errors.email ? (
            <p className="field-error">{fe.errors.email}</p>
          ) : null}
        </div>
        <div className="field">
          <label>Mensaje de la invitación</label>
          <textarea
            className="textarea"
            rows={4}
            maxLength={600}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setMessageTouched(true);
            }}
          />
          <div className="text-faint text-[11.5px]">
            Se precarga según el rol; escribilo como quieras — va tal cual en el
            correo.
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
  const fe = useFormErrors();

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
    if (
      !fe.check({
        name: !name.trim() ? "Ingresá un nombre para el rol." : null,
      })
    )
      return;
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
    if (!res.ok) return fe.fromAction(res.error);
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
            {role ? "Guardar cambios" : "Crear rol"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className={`field ${fe.errors.name ? "invalid" : ""}`}>
          <label>Nombre del rol</label>
          <input
            className="input"
            aria-invalid={!!fe.errors.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Atención al cliente"
          />
          {fe.errors.name ? (
            <p className="field-error">{fe.errors.name}</p>
          ) : null}
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
                            className={`check ${on ? "on" : ""}`}
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
