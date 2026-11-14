import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/widgets/common.dart';
import 'admin_widgets.dart';

/// Esqueleto de cualquier pantalla de módulo del panel (se abre sobre la barra
/// del panel, con su flecha de volver). Si el usuario no tiene el permiso `ver`
/// del módulo, muestra "Sin acceso" en vez del contenido: el servidor igual lo
/// vuelve a verificar en cada endpoint.
class AdminModuleScaffold extends ConsumerWidget {
  const AdminModuleScaffold({
    super.key,
    required this.title,
    required this.permission,
    required this.body,
    this.actions = const [],
    this.floatingActionButton,
    this.what,
  });

  final String title;

  /// Módulo de permisos del servidor (`pedidos`, `productos`, `config`…).
  final String permission;
  final Widget body;
  final List<Widget> actions;
  final Widget? floatingActionButton;

  /// Cómo se nombra en "Sin acceso a …".
  final String? what;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final denied = me != null && !me.can(permission, 'ver');
    return Scaffold(
      appBar: AppBar(title: Text(title), actions: actions),
      // La app dibuja de borde a borde: sin esto, el final de cada lista
      // quedaba debajo de la barra de gestos (iPhone) o de los tres botones
      // (Android). El módulo termina justo arriba de esa barra.
      body: SafeArea(
        top: false,
        child: denied ? AccessDenied(what: what ?? title.toLowerCase()) : body,
      ),
      floatingActionButton: denied ? null : floatingActionButton,
    );
  }
}

/// Marcador de un módulo que todavía no está construido.
class ComingSoon extends StatelessWidget {
  const ComingSoon({super.key, required this.title});
  final String title;

  @override
  Widget build(BuildContext context) => EmptyView(
        icon: Icons.construction_rounded,
        title: title,
        subtitle: 'Esta sección se está terminando de armar.',
      );
}
