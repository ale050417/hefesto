import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import 'config_api.dart';
import 'config_models.dart';
import 'config_widgets.dart';
import 'invite_screen.dart';
import 'role_edit_screen.dart';

/// Equipo y roles: quién entra al panel, con qué rol, y qué puede hacer cada
/// rol. Ver la lista alcanza con el permiso de Configuración; invitar, cambiar
/// roles, quitar acceso y editar roles es SOLO para administradores (el
/// servidor lo vuelve a verificar).
class EquipoScreen extends ConsumerWidget {
  const EquipoScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teamAsync = ref.watch(adminTeamProvider);
    final team = teamAsync.value;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Equipo y roles'),
          bottom: TabBar(
            indicatorColor: Brand.gold,
            labelColor: Brand.gold,
            unselectedLabelColor: context.hc.textDim,
            labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontFamily: 'Sora'),
            tabs: [
              Tab(text: team == null ? 'Equipo' : 'Equipo (${team.team.length})'),
              Tab(text: team == null ? 'Roles' : 'Roles (${team.roles.length})'),
            ],
          ),
        ),
        body: team == null
            ? (teamAsync.hasError
                ? ErrorView(
                    message: apiErrorText(teamAsync.error!),
                    onRetry: () => ref.invalidate(adminTeamProvider),
                  )
                : const ListSkeleton(rows: 5, height: 84))
            : TabBarView(
                children: [
                  TeamTab(data: team),
                  RolesTab(data: team),
                ],
              ),
      ),
    );
  }
}

Future<void> _refresh(WidgetRef ref) async {
  ref.invalidate(adminTeamProvider);
  await ref.read(adminTeamProvider.future).then((_) {}, onError: (_) {});
}

// --- Equipo ---

class TeamTab extends ConsumerWidget {
  const TeamTab({super.key, required this.data});
  final TeamData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.hc;
    return RefreshIndicator(
      color: Brand.gold,
      onRefresh: () => _refresh(ref),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${data.activeCount} activo${data.activeCount == 1 ? '' : 's'}'
                  '${data.pendingCount > 0 ? ' · ${data.pendingCount} pendiente${data.pendingCount == 1 ? '' : 's'}' : ''}',
                  style: TextStyle(fontSize: 13, color: c.textDim, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (data.canManage)
            GoldButton(
              label: 'Invitar a alguien',
              icon: Icons.person_add_alt_1_rounded,
              onPressed: data.roles.isEmpty
                  ? null
                  : () => Navigator.of(context).push(
                        MaterialPageRoute<void>(builder: (_) => InviteScreen(roles: data.roles)),
                      ),
            )
          else
            AdminCard(
              accent: Brand.info,
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  const Icon(Icons.lock_outline_rounded, size: 18, color: Brand.info),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Solo un administrador puede invitar gente, cambiar roles o quitar accesos.',
                      style: TextStyle(fontSize: 13, color: c.text),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 14),
          if (data.team.isEmpty)
            const EmptyView(
              icon: Icons.groups_rounded,
              title: 'Todavía no hay miembros',
              subtitle: 'Invitá a alguien para que entre al panel.',
            )
          else
            for (final m in data.team)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: MemberTile(
                  member: m,
                  onTap: data.canManage ? () => _openMember(context, ref, m) : null,
                ),
              ),
        ],
      ),
    );
  }

  void _openMember(BuildContext context, WidgetRef ref, TeamMemberInfo m) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => MemberSheet(member: m, roles: data.roles),
    );
  }
}

class MemberTile extends StatelessWidget {
  const MemberTile({super.key, required this.member, this.onTap});
  final TeamMemberInfo member;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final initial = member.displayName.trim().isEmpty ? '?' : member.displayName.trim()[0].toUpperCase();
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      child: Row(
        children: [
          CircleAvatar(
            radius: 21,
            backgroundColor: Brand.gold.withValues(alpha: 0.16),
            child: Text(initial, style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.gold, fontSize: 16)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${member.displayName}${member.isSelf ? ' (vos)' : ''}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                ),
                if (member.email != null)
                  Text(
                    member.email!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12.5, color: c.textDim),
                  ),
                const SizedBox(height: 7),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    StateChip(
                      member.roleLabel,
                      color: member.isAdmin ? Brand.gold : Brand.info,
                      icon: member.isAdmin ? Icons.shield_rounded : Icons.badge_rounded,
                    ),
                    member.pending
                        ? const StateChip('Invitación pendiente', color: Brand.warning, icon: Icons.schedule_send_rounded)
                        : const StateChip('Activo', color: Brand.success, icon: Icons.check_circle_rounded),
                  ],
                ),
              ],
            ),
          ),
          if (onTap != null) Icon(Icons.more_vert_rounded, color: c.textFaint),
        ],
      ),
    );
  }
}

/// Acciones sobre un miembro: cambiar rol, reenviar invitación, quitar acceso.
class MemberSheet extends ConsumerStatefulWidget {
  const MemberSheet({super.key, required this.member, required this.roles});
  final TeamMemberInfo member;
  final List<RoleInfo> roles;

  @override
  ConsumerState<MemberSheet> createState() => _MemberSheetState();
}

class _MemberSheetState extends ConsumerState<MemberSheet> {
  bool _busy = false;
  String? _error;

  Future<void> _run(Future<String> Function() call) async {
    // Se toman antes: al cerrar la hoja este contexto deja de existir.
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    final container = ProviderScope.containerOf(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final okMessage = await call();
      container.invalidate(adminTeamProvider);
      if (!mounted) return;
      nav.pop();
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(okMessage)));
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = apiErrorText(e);
      });
    }
  }

  Future<void> _changeRole() async {
    final m = widget.member;
    final picked = await showDialog<String>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Elegí el rol'),
        children: [
          for (final r in widget.roles)
            SimpleDialogOption(
              onPressed: () => Navigator.of(ctx).pop(r.id),
              child: Row(
                children: [
                  Icon(
                    r.id == m.roleId ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded,
                    color: r.id == m.roleId ? Brand.gold : null,
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Text(r.name, style: const TextStyle(fontWeight: FontWeight.w600))),
                ],
              ),
            ),
        ],
      ),
    );
    if (picked == null || picked == m.roleId || !mounted) return;
    await _run(() async {
      await ref.read(configApiProvider).assignRole(m.id, picked);
      return 'Rol actualizado';
    });
  }

  Future<void> _resend() async {
    final m = widget.member;
    await _run(() async {
      final res = await ref.read(configApiProvider).resendInvite(m.id);
      return 'Invitación reenviada a ${res['email'] ?? (m.email ?? 'la persona')}';
    });
  }

  Future<void> _remove() async {
    final m = widget.member;
    final ok = await confirmAction(
      context,
      title: 'Quitar acceso',
      message: '${m.displayName} deja de poder entrar al panel. Su cuenta sigue existiendo como cliente.',
      confirmLabel: 'Quitar acceso',
      destructive: true,
    );
    if (!ok || !mounted) return;
    await _run(() async {
      await ref.read(configApiProvider).removeMember(m.id);
      return 'Acceso revocado';
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final m = widget.member;
    final locked = m.isSelf || m.isLastAdmin;
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(m.displayName, style: Theme.of(context).textTheme.titleLarge),
            if (m.email != null) Text(m.email!, style: TextStyle(color: c.textDim, fontSize: 13)),
            const SizedBox(height: 4),
            Text('Rol actual: ${m.roleLabel}', style: TextStyle(color: c.textDim, fontSize: 13)),
            const SizedBox(height: 14),
            if (locked)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AdminCard(
                  accent: Brand.info,
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    m.isSelf
                        ? 'Sos vos: no podés cambiarte el rol ni quitarte el acceso.'
                        : 'Es el último administrador: tiene que quedar al menos uno.',
                    style: TextStyle(fontSize: 13, color: c.text, height: 1.35),
                  ),
                ),
              ),
            if (m.pending)
              _SheetAction(
                icon: Icons.send_rounded,
                label: 'Reenviar invitación',
                hint: 'Manda un link nuevo (el anterior deja de servir).',
                onTap: _busy ? null : _resend,
              ),
            if (!locked) ...[
              _SheetAction(
                icon: Icons.swap_horiz_rounded,
                label: 'Cambiar rol',
                hint: 'Hoy: ${m.roleLabel}',
                onTap: _busy ? null : _changeRole,
              ),
              _SheetAction(
                icon: Icons.person_remove_rounded,
                label: 'Quitar acceso al panel',
                color: Brand.danger,
                onTap: _busy ? null : _remove,
              ),
            ],
            if (_busy)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Center(child: CircularProgressIndicator(color: Brand.gold)),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(_error!, style: const TextStyle(color: Brand.danger, fontSize: 13)),
              ),
          ],
        ),
      ),
    );
  }
}

class _SheetAction extends StatelessWidget {
  const _SheetAction({required this.icon, required this.label, this.hint, this.color, this.onTap});
  final IconData icon;
  final String label;
  final String? hint;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final tint = color ?? c.text;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      enabled: onTap != null,
      leading: Icon(icon, color: color ?? Brand.gold),
      title: Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: tint)),
      subtitle: hint == null ? null : Text(hint!, style: TextStyle(color: c.textDim, fontSize: 12)),
      onTap: onTap,
    );
  }
}

// --- Roles ---

class RolesTab extends ConsumerWidget {
  const RolesTab({super.key, required this.data});
  final TeamData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.hc;
    return RefreshIndicator(
      color: Brand.gold,
      onRefresh: () => _refresh(ref),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          Text(
            'Definí qué puede hacer cada rol en el panel.',
            style: TextStyle(fontSize: 13, color: c.textDim),
          ),
          const SizedBox(height: 10),
          if (data.canManage)
            GoldButton(
              label: 'Nuevo rol',
              icon: Icons.add_rounded,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => RoleEditScreen(modules: data.modules, canManage: true)),
              ),
            ),
          const SizedBox(height: 14),
          for (final r in data.roles)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: RoleTile(
                role: r,
                moduleCount: data.modules.length,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => RoleEditScreen(role: r, modules: data.modules, canManage: data.canManage),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class RoleTile extends StatelessWidget {
  const RoleTile({super.key, required this.role, required this.moduleCount, required this.onTap});
  final RoleInfo role;
  final int moduleCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final people = '${role.memberCount} persona${role.memberCount == 1 ? '' : 's'}';
    final access = role.isAdmin ? 'Acceso total' : 'Ve ${role.visibleModules} de $moduleCount módulos';
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: (role.isAdmin ? Brand.gold : Brand.info).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(
              role.isAdmin ? Icons.shield_rounded : Icons.badge_rounded,
              color: role.isAdmin ? Brand.gold : Brand.info,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  role.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                ),
                const SizedBox(height: 2),
                Text('$access · $people', style: TextStyle(fontSize: 12.5, color: c.textDim)),
                if (role.isSystem) ...[const SizedBox(height: 6), const MiniTag('Rol de sistema')],
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: c.textFaint),
        ],
      ),
    );
  }
}
