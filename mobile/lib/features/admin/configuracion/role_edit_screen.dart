import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../admin_widgets.dart';
import 'config_api.dart';
import 'config_models.dart';
import 'config_widgets.dart';

const List<(String, String)> permActions = [
  ('ver', 'Ver'),
  ('crear', 'Crear'),
  ('editar', 'Editar'),
  ('eliminar', 'Eliminar'),
];

/// Crear o editar un rol: nombre y permisos (ver / crear / editar / eliminar)
/// por módulo del panel. El rol Administrador (acceso total) y los roles que
/// ve alguien que no es administrador se muestran en solo lectura.
class RoleEditScreen extends ConsumerStatefulWidget {
  const RoleEditScreen({super.key, this.role, required this.modules, required this.canManage});

  /// null = rol nuevo.
  final RoleInfo? role;
  final List<PermModuleInfo> modules;
  final bool canManage;

  @override
  ConsumerState<RoleEditScreen> createState() => _RoleEditScreenState();
}

class _RoleEditScreenState extends ConfigFormState<RoleEditScreen> {
  late final _name = TextEditingController(text: widget.role?.name ?? '');
  late final Map<String, Set<String>> _perms = {
    for (final e in (widget.role?.permissions ?? const <String, Set<String>>{}).entries) e.key: {...e.value},
  };
  String? _nameError;
  bool _deleting = false;

  bool get _isNew => widget.role == null;
  bool get _readOnly => !widget.canManage || (widget.role?.isAdmin ?? false);

  @override
  void initState() {
    super.initState();
    markClean();
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Map<String, List<String>> _clean() => {
        for (final m in widget.modules)
          if ((_perms[m.key] ?? const <String>{}).isNotEmpty)
            m.key: [
              // Orden fijo, para que "igual" sea igual.
              for (final (a, _) in permActions)
                if (_perms[m.key]!.contains(a)) a,
            ],
      };

  @override
  Object? snapshot() => {'name': _name.text.trim(), 'permissions': _clean()};

  void _toggle(String module, String action) => setState(() {
        error = null;
        final cur = _perms.putIfAbsent(module, () => <String>{});
        if (!cur.remove(action)) cur.add(action);
      });

  void _setAll(bool on) => setState(() {
        error = null;
        for (final m in widget.modules) {
          _perms[m.key] = on ? {for (final (a, _) in permActions) a} : <String>{};
        }
      });

  Future<void> _onSave() async {
    FocusScope.of(context).unfocus();
    if (_name.text.trim().isEmpty) {
      setState(() {
        _nameError = 'Ingresá un nombre para el rol.';
        error = 'Revisá los campos marcados.';
      });
      return;
    }
    setState(() => _nameError = null);
    final api = ref.read(configApiProvider);
    final container = ProviderScope.containerOf(context);
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    setState(() {
      saving = true;
      error = null;
    });
    try {
      if (_isNew) {
        await api.createRole(_name.text.trim(), _clean());
      } else {
        await api.updateRole(widget.role!.id, _name.text.trim(), _clean());
      }
      container.invalidate(adminTeamProvider);
      if (!mounted) return;
      markClean();
      setState(() => saving = false);
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(_isNew ? 'Rol creado' : 'Rol actualizado')));
      nav.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        saving = false;
        error = apiErrorText(e);
      });
    }
  }

  Future<void> _delete() async {
    final role = widget.role!;
    final ok = await confirmAction(
      context,
      title: 'Borrar rol',
      message: '"${role.name}" se elimina. Si hay personas con este rol, primero cambiales el rol.',
      confirmLabel: 'Borrar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    final container = ProviderScope.containerOf(context);
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    setState(() {
      _deleting = true;
      error = null;
    });
    try {
      await ref.read(configApiProvider).deleteRole(role.id);
      container.invalidate(adminTeamProvider);
      if (!mounted) return;
      markClean();
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Rol eliminado')));
      nav.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _deleting = false;
        error = apiErrorText(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final role = widget.role;
    final editable = !_readOnly && !_deleting;
    return ConfigSectionScaffold(
      title: _isNew ? 'Nuevo rol' : (role!.name),
      dirty: dirty,
      saving: saving || _deleting,
      canEdit: !_readOnly,
      error: error,
      saveLabel: _isNew ? 'Crear rol' : 'Guardar cambios',
      readOnlyNote: role?.isAdmin == true
          ? 'El rol Administrador tiene acceso total y no se edita.'
          : 'Solo un administrador puede editar roles.',
      onSave: _onSave,
      onChanged: touch,
      children: [
        ConfigField(
          controller: _name,
          label: 'Nombre del rol',
          hint: 'Ej: Atención al cliente',
          errorText: _nameError,
          maxLength: 60,
          enabled: editable,
          textCapitalization: TextCapitalization.sentences,
        ),
        if (role != null) ...[
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (role.isSystem) const MiniTag('Rol de sistema'),
              MiniTag('${role.memberCount} persona${role.memberCount == 1 ? '' : 's'}'),
            ],
          ),
          const SizedBox(height: 6),
        ],
        AdminSectionTitle(
          'Permisos por módulo',
        ),
        if (role?.isAdmin == true)
          AdminCard(
            padding: const EdgeInsets.all(14),
            child: Text(
              'Acceso total a todos los módulos.',
              style: TextStyle(color: c.textDim, fontSize: 13.5),
            ),
          )
        else ...[
          if (editable)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Wrap(
                spacing: 4,
                children: [
                  TextButton.icon(
                    onPressed: () => _setAll(true),
                    icon: const Icon(Icons.done_all_rounded, size: 18),
                    label: const Text('Marcar todo'),
                  ),
                  TextButton.icon(
                    onPressed: () => _setAll(false),
                    icon: const Icon(Icons.remove_done_rounded, size: 18),
                    label: const Text('Quitar todo'),
                  ),
                ],
              ),
            ),
          for (final m in widget.modules)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AdminCard(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(m.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      children: [
                        for (final (action, label) in permActions)
                          FilterChip(
                            label: Text(label),
                            selected: _perms[m.key]?.contains(action) ?? false,
                            showCheckmark: true,
                            onSelected: editable ? (_) => _toggle(m.key, action) : null,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
        ],
        if (!_isNew && widget.canManage && !(role?.isSystem ?? true)) ...[
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: _deleting || saving ? null : _delete,
            icon: const Icon(Icons.delete_outline_rounded, color: Brand.danger),
            label: const Text('Borrar rol', style: TextStyle(color: Brand.danger)),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              side: BorderSide(color: Brand.danger.withValues(alpha: 0.5)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ],
      ],
    );
  }
}
