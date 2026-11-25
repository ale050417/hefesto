import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import 'filament_types_screen.dart';
import 'filamentos_api.dart';
import 'filamentos_models.dart';
import 'shared_widgets.dart';

const noTypeLabel = 'Sin tipo (precio propio)';

/// Abre "Tipos y precios" a pantalla completa (sobre el navegador raíz, igual
/// que las demás subpantallas de Filamentos).
Future<void> openFilamentTypes(BuildContext context) => Navigator.of(context, rootNavigator: true)
    .push<void>(MaterialPageRoute(builder: (_) => const FilamentTypesScreen()));

/// Campo de solo lectura "Tipo (precio)" del formulario de un carrete: abre el
/// selector al tocarlo.
class FilamentTypeField extends StatelessWidget {
  const FilamentTypeField({super.key, required this.type, required this.hasType, required this.onTap});

  /// El tipo elegido, si ya se cargó la lista.
  final FilamentType? type;

  /// El carrete tiene tipo (aunque la lista todavía no haya llegado).
  final bool hasType;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final t = type;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: InputDecorator(
        decoration: const InputDecoration(
          labelText: 'Tipo (precio)',
          suffixIcon: Icon(Icons.unfold_more_rounded),
        ),
        child: Text(
          t != null ? '${t.name} — ${formatPrice(t.costPerKg)}/kg' : (hasType ? 'Con tipo' : noTypeLabel),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: c.text, fontSize: 15),
        ),
      ),
    );
  }
}

/// Abre el selector de tipo. Devuelve `(typeId: …)` con el tipo elegido
/// (`typeId: null` = sin tipo, precio propio), o null si se cerró sin elegir.
Future<({String? typeId})?> showFilamentTypePicker(BuildContext context, {required String? current}) {
  return showAppSheet<({String? typeId})>(context, builder: (_) => _TypePickerSheet(current: current));
}

class _TypePickerSheet extends ConsumerWidget {
  const _TypePickerSheet({required this.current});
  final String? current;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.hc;
    final data = ref.watch(filamentTypesProvider);

    Widget tile({required String title, String? subtitle, required String? id}) => ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 20),
          title: Text(
            title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
          ),
          subtitle: subtitle == null ? null : Text(subtitle),
          trailing: id == current ? const Icon(Icons.check_circle_rounded, color: Brand.gold) : null,
          onTap: () => Navigator.of(context).pop((typeId: id)),
        );

    return PickerSheet(
      title: 'Tipo (precio)',
      action: TextButton.icon(
        onPressed: () => openFilamentTypes(context),
        icon: const Icon(Icons.sell_outlined, size: 18),
        label: const Text('Tipos y precios'),
      ),
      child: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: '$e', onRetry: () => ref.invalidate(filamentTypesProvider)),
        data: (d) => ListView(
          shrinkWrap: true,
          padding: PickerSheet.listPadding(context),
          children: [
            tile(title: noTypeLabel, subtitle: 'El costo por kg se carga en este carrete.', id: null),
            for (final t in d.types) tile(title: t.name, subtitle: '${formatPrice(t.costPerKg)} por kg', id: t.id),
            if (d.types.isEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                child: Text(
                  'Todavía no hay tipos. Cargalos en «Tipos y precios» y el precio se cambia en un solo lugar.',
                  style: TextStyle(fontSize: 12.5, color: c.textFaint, height: 1.4),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
