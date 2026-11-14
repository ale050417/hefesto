import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import 'config_api.dart';
import 'config_models.dart';
import 'config_widgets.dart';

/// Mensaje de bienvenida según el rol elegido (editable antes de enviar).
String inviteTemplate(String roleName) =>
    '¡Hola! Te sumo al equipo de Hefesto 3D como $roleName. Tocá el botón del mail para crear tu '
    'contraseña y entrar al panel. ¡Bienvenido/a!';

final RegExp _emailRe = RegExp(r'.+@.+\..+');

/// Invitar a alguien al equipo (solo administradores): le llega un mail con un
/// link de un solo uso para crear su contraseña. Si ya era cliente, pasa al
/// equipo con su misma cuenta.
class InviteScreen extends ConsumerStatefulWidget {
  const InviteScreen({super.key, required this.roles});
  final List<RoleInfo> roles;

  @override
  ConsumerState<InviteScreen> createState() => _InviteScreenState();
}

class _InviteScreenState extends ConfigFormState<InviteScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  late final _message = TextEditingController(text: inviteTemplate(_role.name));
  late RoleInfo _role = widget.roles.firstWhere((r) => !r.isAdmin, orElse: () => widget.roles.first);
  bool _messageTouched = false;
  String? _emailError;

  @override
  void initState() {
    super.initState();
    markClean();
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _message.dispose();
    super.dispose();
  }

  // Tiene que haber un mail para que haya "algo que enviar"; el resto es relleno.
  @override
  Object? snapshot() => {'email': _email.text.trim(), 'name': _name.text.trim()};

  void _pickRole(RoleInfo r) {
    setState(() {
      error = null;
      _role = r;
      if (!_messageTouched) _message.text = inviteTemplate(r.name);
    });
  }

  Future<void> _onSave() async {
    FocusScope.of(context).unfocus();
    final mail = _email.text.trim();
    setState(() {
      _emailError = mail.isEmpty
          ? 'Ingresá el email de la persona.'
          : (!_emailRe.hasMatch(mail) ? 'Ingresá un email válido.' : null);
    });
    if (_emailError != null) return;

    final container = ProviderScope.containerOf(context);
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    setState(() {
      saving = true;
      error = null;
    });
    try {
      final res = await ref.read(configApiProvider).invite(
            email: mail,
            roleId: _role.id,
            fullName: _name.text.trim(),
            message: _message.text.trim(),
          );
      container.invalidate(adminTeamProvider);
      if (!mounted) return;
      markClean(); // enviada: nada que perder al salir
      setState(() => saving = false);
      final promoted = res['promoted'] == true;
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          content: Text(promoted
              ? '$mail ya tenía cuenta: ahora es parte del equipo.'
              : 'Invitación enviada a $mail.'),
        ));
      nav.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        saving = false;
        error = apiErrorText(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return ConfigSectionScaffold(
      title: 'Invitar al equipo',
      dirty: dirty,
      saving: saving,
      canEdit: true,
      error: error,
      saveLabel: 'Enviar invitación',
      onSave: _onSave,
      onChanged: touch,
      children: [
        const ConfigHint(
          'Le llega un mail con un link de un solo uso para crear su contraseña. '
          'Vos nunca ves esa contraseña. Si ya era cliente de la tienda, pasa al equipo con su misma cuenta.',
        ),
        ConfigField(
          controller: _name,
          label: 'Nombre (opcional)',
          hint: 'Ej: Antonella',
          maxLength: 120,
          textCapitalization: TextCapitalization.words,
        ),
        ConfigField(
          controller: _email,
          label: 'Email',
          hint: 'persona@mail.com',
          errorText: _emailError,
          keyboardType: TextInputType.emailAddress,
          maxLength: 160,
        ),
        Padding(
          padding: const EdgeInsets.only(left: 2, bottom: 6),
          child: Text('Rol', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.textDim)),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            for (final r in widget.roles)
              ChoiceChip(
                label: Text(r.name),
                selected: _role.id == r.id,
                onSelected: (_) => _pickRole(r),
              ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 14),
          child: Text(
            _role.isAdmin
                ? 'Administrador: acceso total, incluido el equipo y los roles.'
                : 'Puede ver y hacer solo lo que marque este rol (${_role.visibleModules} módulos).',
            style: TextStyle(fontSize: 12, color: c.textFaint, height: 1.35),
          ),
        ),
        TextFormField(
          controller: _message,
          maxLines: 5,
          minLines: 3,
          maxLength: 600,
          onChanged: (_) => _messageTouched = true,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(labelText: 'Mensaje en el mail', counterText: ''),
        ),
      ],
    );
  }
}
