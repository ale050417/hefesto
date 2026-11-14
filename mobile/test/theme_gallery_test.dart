// Galería del tema: dibuja los componentes y los modales estándar (diálogo,
// hoja, calendario, reloj, menú, aviso) en teléfono chico y en iPhone, en los
// tres modos. Es la red de seguridad del tema: si un cambio de `app_theme.dart`
// rompe un modal (desborde, texto en inglés, botón tapado), falla acá.
// Con SHOT_DIR=carpeta guarda una captura de cada uno para mirarlos.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/core/widgets/modals.dart';
import 'package:hefesto/features/admin/crecimiento/form_kit.dart';

import 'support/device_kit.dart';

/// Página con un botón por modal (cada test toca el suyo).
class _Launcher extends StatelessWidget {
  const _Launcher();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Galería'),
        actions: [
          PopupMenuButton<String>(
            key: const Key('menu'),
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'a', child: Text('Editar')),
              PopupMenuItem(value: 'b', child: Text('Duplicar')),
              PopupMenuDivider(),
              PopupMenuItem(value: 'c', child: Text('Eliminar')),
            ],
          ),
        ],
      ),
      body: Builder(
        builder: (context) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            FilledButton(
              key: const Key('confirm'),
              onPressed: () => confirmAction(
                context,
                title: '¿Eliminar el cupón HEFESTO15?',
                message: 'Los pedidos que ya lo usaron conservan su descuento. Esta acción no se puede deshacer.',
                confirmLabel: 'Eliminar',
                destructive: true,
              ),
              child: const Text('Confirmación'),
            ),
            FilledButton(
              key: const Key('dialog_form'),
              onPressed: () => showDialog<void>(
                context: context,
                builder: (ctx) => AlertDialog(
                  // Con campos adentro SIEMPRE `scrollable`: en un teléfono
                  // chico con el teclado abierto el diálogo no entra entero.
                  scrollable: true,
                  title: const Text('Motivo de la cancelación'),
                  content: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Se le avisa al cliente por email con este texto.'),
                      const SizedBox(height: 12),
                      TextField(
                        key: const Key('dialog_field'),
                        maxLines: 3,
                        decoration: const InputDecoration(labelText: 'Motivo'),
                      ),
                    ],
                  ),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Volver')),
                    FilledButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar pedido')),
                  ],
                ),
              ),
              child: const Text('Diálogo con campo'),
            ),
            FilledButton(
              key: const Key('simple'),
              onPressed: () => showDialog<void>(
                context: context,
                builder: (ctx) => SimpleDialog(
                  title: const Text('Ordenar por'),
                  children: [
                    for (final o in ['Más nuevos', 'Precio: menor a mayor', 'Nombre (A-Z)'])
                      SimpleDialogOption(onPressed: () => Navigator.pop(ctx), child: Text(o)),
                  ],
                ),
              ),
              child: const Text('Lista de opciones'),
            ),
            FilledButton(
              key: const Key('sheet'),
              onPressed: () => showAppSheet<void>(context, builder: (ctx) => const _SampleSheet()),
              child: const Text('Hoja inferior'),
            ),
            FilledButton(
              key: const Key('date'),
              onPressed: () => showDatePicker(
                context: context,
                initialDate: DateTime(2026, 11, 14),
                firstDate: DateTime(2023),
                lastDate: DateTime(2027),
                helpText: 'Fecha de la venta',
                cancelText: 'Cancelar',
                confirmText: 'Aceptar',
              ),
              child: const Text('Calendario'),
            ),
            FilledButton(
              key: const Key('time'),
              onPressed: () => pickTime(context, initial: const TimeOfDay(hour: 9, minute: 30)),
              child: const Text('Reloj'),
            ),
            FilledButton(
              key: const Key('day'),
              onPressed: () => pickDay(context, initial: DateTime(2026, 11, 14)),
              child: const Text('Día (propio)'),
            ),
            FilledButton(
              key: const Key('snack'),
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Text('Venta eliminada. El stock se devolvió al filamento.'),
                  action: SnackBarAction(label: 'Deshacer', onPressed: () {}),
                ),
              ),
              child: const Text('Aviso'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SampleSheet extends StatelessWidget {
  const _SampleSheet();

  @override
  Widget build(BuildContext context) {
    return SheetBody(
      title: 'Ajustar stock',
      subtitle: 'PLA · Rojo · Grilon3 · hoy 120 g',
      footer: GoldButton(
        key: const Key('sheet_save'),
        label: 'Aplicar ajuste',
        icon: Icons.check_rounded,
        onPressed: () {},
      ),
      children: [
        SizedBox(
          width: double.infinity,
          child: SegmentedButton<int>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: 0, label: Text('Sumar')),
              ButtonSegment(value: 1, label: Text('Restar')),
              ButtonSegment(value: 2, label: Text('Contado')),
            ],
            selected: const {0},
            onSelectionChanged: (_) {},
          ),
        ),
        const SizedBox(height: 14),
        const TextField(
          key: Key('sheet_field'),
          decoration: InputDecoration(labelText: 'Gramos', suffixText: 'g'),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ChoiceChip(label: const Text('Compra'), selected: true, onSelected: (_) {}),
            ChoiceChip(label: const Text('Conteo físico'), selected: false, onSelected: (_) {}),
            ChoiceChip(label: const Text('Merma'), selected: false, onSelected: (_) {}),
          ],
        ),
        const SizedBox(height: 12),
        const TextField(
          key: Key('sheet_note'),
          decoration: InputDecoration(labelText: 'Motivo (opcional)'),
        ),
      ],
    );
  }
}

/// Todos los controles sueltos en una sola página.
class _Controls extends StatelessWidget {
  const _Controls();

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Controles'),
          actions: [IconButton(onPressed: () {}, icon: const Icon(Icons.refresh_rounded))],
          bottom: const TabBar(tabs: [Tab(text: 'Calcular'), Tab(text: 'Historial'), Tab(text: 'Tipos')]),
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () {},
          icon: const Icon(Icons.add_rounded),
          label: const Text('Nuevo cliente'),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
          children: [
            GoldButton(label: 'Guardar cambios', onPressed: () {}),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: FilledButton(onPressed: () {}, child: const Text('Aceptar'))),
                const SizedBox(width: 8),
                Expanded(child: OutlinedButton(onPressed: () {}, child: const Text('Cancelar'))),
              ],
            ),
            Row(
              children: [
                Expanded(child: FilledButton(onPressed: null, child: const Text('Deshabilitado'))),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.person_add_alt_1_rounded),
                    label: const Text('Agregar'),
                  ),
                ),
              ],
            ),
            Row(
              children: [
                TextButton(onPressed: () {}, child: const Text('Ver todo')),
                TextButton(onPressed: null, child: const Text('Apagado')),
                const Spacer(),
                IconButton(onPressed: () {}, icon: const Icon(Icons.delete_outline_rounded)),
              ],
            ),
            const Divider(),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Solo ofertas'),
              subtitle: const Text('Muestra los productos con descuento'),
              value: true,
              onChanged: (_) {},
            ),
            Row(
              children: [
                const Expanded(child: Text('Vidriera digital')),
                Switch(value: false, onChanged: (_) {}),
                Switch(value: true, onChanged: (_) {}),
                const Switch(value: true, onChanged: null),
              ],
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: SegmentedButton<int>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: 0, label: Text('Izquierda'), icon: Icon(Icons.format_align_left_rounded)),
                  ButtonSegment(value: 1, label: Text('Centro'), icon: Icon(Icons.format_align_center_rounded)),
                  ButtonSegment(value: 2, label: Text('Derecha'), icon: Icon(Icons.format_align_right_rounded)),
                ],
                selected: const {1},
                onSelectionChanged: (_) {},
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ChoiceChip(label: const Text('Todas'), selected: true, onSelected: (_) {}),
                ChoiceChip(label: const Text('Llaveros'), selected: false, onSelected: (_) {}),
                FilterChip(label: const Text('Con stock'), selected: true, onSelected: (_) {}),
                FilterChip(label: const Text('Ocultos'), selected: false, onSelected: (_) {}),
                ActionChip(label: const Text('250 g'), onPressed: () {}),
                InputChip(label: const Text('PLA'), onDeleted: () {}),
              ],
            ),
            const SizedBox(height: 12),
            RangeSlider(values: const RangeValues(20, 70), min: 0, max: 100, onChanged: (_) {}),
            Slider(value: 40, min: 0, max: 100, onChanged: (_) {}),
            const SizedBox(height: 8),
            const LinearProgressIndicator(value: 0.37),
            const SizedBox(height: 14),
            const TextField(decoration: InputDecoration(labelText: 'Nombre', hintText: 'Ej: Mate Mario')),
            const SizedBox(height: 12),
            const TextField(
              decoration: InputDecoration(
                labelText: 'Precio',
                prefixText: '\$ ',
                errorText: 'Ingresá un precio mayor a 0',
              ),
            ),
            const SizedBox(height: 12),
            const TextField(
              enabled: false,
              decoration: InputDecoration(labelText: 'Código (no editable)', helperText: 'Se genera solo'),
            ),
            const SizedBox(height: 12),
            ListTile(
              leading: const Icon(Icons.storefront_rounded),
              title: const Text('Volver a la tienda'),
              subtitle: const Text('Sale del panel'),
              trailing: Icon(Icons.chevron_right_rounded, color: c.textFaint),
              onTap: () {},
            ),
            Row(
              children: [
                const CircularProgressIndicator(),
                const SizedBox(width: 16),
                Badge(label: const Text('3'), child: const Icon(Icons.receipt_long_outlined)),
                const SizedBox(width: 16),
                const Tooltip(message: 'Volver a cargar', child: Icon(Icons.info_outline_rounded)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

void main() {
  setUpAll(setUpDeviceKit);

  for (final mode in HefestoThemeMode.values) {
    group('tema ${mode.name}', () {
      for (final phone in Phone.both) {
        testWidgets('controles en ${phone.name}', (tester) async {
          await pumpPhone(tester, const _Controls(), phone: phone, theme: mode);
          await shoot(tester, 'tema_${mode.name}_controles');
          await tester.drag(find.byType(ListView), const Offset(0, -420));
          await settle(tester, 3);
          expectNoLayoutErrors(tester);
          await shoot(tester, 'tema_${mode.name}_controles2');
        });

        testWidgets('confirmación en ${phone.name}', (tester) async {
          await pumpPhone(tester, const _Launcher(), phone: phone, theme: mode);
          await tester.tap(find.byKey(const Key('confirm')));
          await settle(tester);
          expectNoLayoutErrors(tester);
          expectReachable(tester, find.widgetWithText(FilledButton, 'Eliminar'), what: 'el botón de confirmar');
          expectReachable(tester, find.widgetWithText(TextButton, 'Cancelar'), what: 'el botón de cancelar');
          await shoot(tester, 'tema_${mode.name}_confirmacion');
        });

        testWidgets('diálogo con campo y teclado en ${phone.name}', (tester) async {
          await pumpPhone(tester, const _Launcher(), phone: phone, theme: mode);
          await tester.tap(find.byKey(const Key('dialog_form')));
          await settle(tester);
          await openKeyboard(tester, find.byKey(const Key('dialog_field')));
          expectFocusedFieldVisible(tester);
          expectReachable(tester, find.widgetWithText(FilledButton, 'Cancelar pedido'), what: 'la acción del diálogo');
          await shoot(tester, 'tema_${mode.name}_dialogo_teclado');
        });

        testWidgets('lista de opciones en ${phone.name}', (tester) async {
          await pumpPhone(tester, const _Launcher(), phone: phone, theme: mode);
          await tester.tap(find.byKey(const Key('simple')));
          await settle(tester);
          expectNoLayoutErrors(tester);
          await shoot(tester, 'tema_${mode.name}_opciones');
        });

        testWidgets('hoja inferior con teclado en ${phone.name}', (tester) async {
          await pumpPhone(tester, const _Launcher(), phone: phone, theme: mode);
          await tester.tap(find.byKey(const Key('sheet')));
          await settle(tester);
          expectNoLayoutErrors(tester);
          expectReachable(tester, find.byKey(const Key('sheet_save')), what: 'el botón de la hoja');
          await shoot(tester, 'tema_${mode.name}_hoja');
          await openKeyboard(tester, find.byKey(const Key('sheet_field')));
          expectFocusedFieldVisible(tester);
          expectReachable(tester, find.byKey(const Key('sheet_save')), what: 'el botón de la hoja con el teclado abierto');
          expect(
            tester.getRect(find.text('Ajustar stock')).top >= currentPhone.top,
            isTrue,
            reason: 'la hoja no puede meterse debajo de la barra de estado',
          );
          await shoot(tester, 'tema_${mode.name}_hoja_teclado');
          // El segundo campo también tiene que quedar a la vista al enfocarlo.
          await tester.tap(find.byKey(const Key('sheet_note')), warnIfMissed: false);
          await settle(tester, 4);
          expectFocusedFieldVisible(tester);
        });

        testWidgets('calendario en castellano en ${phone.name}', (tester) async {
          await pumpPhone(tester, const _Launcher(), phone: phone, theme: mode);
          await tester.tap(find.byKey(const Key('date')));
          await settle(tester);
          expectNoLayoutErrors(tester);
          expect(find.text('Fecha de la venta'), findsOneWidget);
          expect(find.text('Cancelar'), findsOneWidget, reason: 'los botones del calendario van en castellano');
          expect(find.text('Aceptar'), findsOneWidget);
          expect(find.textContaining('noviembre'), findsWidgets);
          expectReachable(tester, find.text('Aceptar'), what: 'el botón Aceptar del calendario');
          await shoot(tester, 'tema_${mode.name}_calendario');
        });

        testWidgets('reloj en castellano en ${phone.name}', (tester) async {
          await pumpPhone(tester, const _Launcher(), phone: phone, theme: mode);
          await tester.tap(find.byKey(const Key('time')));
          await settle(tester);
          expectNoLayoutErrors(tester);
          expect(find.text('Elegí la hora'), findsOneWidget);
          expect(find.text('Cancelar'), findsOneWidget);
          expect(find.text('Aceptar'), findsOneWidget);
          expectReachable(tester, find.text('Aceptar'), what: 'el botón Aceptar del reloj');
          await shoot(tester, 'tema_${mode.name}_reloj');
        });

        testWidgets('selector de día propio en ${phone.name}', (tester) async {
          await pumpPhone(tester, const _Launcher(), phone: phone, theme: mode);
          await tester.tap(find.byKey(const Key('day')));
          await settle(tester);
          expectNoLayoutErrors(tester);
          expectReachable(tester, find.text('Aceptar'), what: 'el botón Aceptar');
          await shoot(tester, 'tema_${mode.name}_dia');
        });

        testWidgets('menú y aviso en ${phone.name}', (tester) async {
          await pumpPhone(tester, const _Launcher(), phone: phone, theme: mode);
          await tester.tap(find.byKey(const Key('snack')));
          await settle(tester, 4);
          await tester.tap(find.byKey(const Key('menu')));
          await settle(tester);
          expectNoLayoutErrors(tester);
          expect(find.text('Duplicar'), findsOneWidget);
          await shoot(tester, 'tema_${mode.name}_menu_aviso');
        });
      }

      testWidgets('letra grande (1,3×) en el teléfono chico: nada se desborda', (tester) async {
        await pumpPhone(tester, const _Controls(), phone: Phone.small, theme: mode, textScale: 1.3);
        await shoot(tester, 'tema_${mode.name}_controles_grande');
        await pumpPhone(tester, const _Launcher(), phone: Phone.small, theme: mode, textScale: 1.3);
        for (final k in ['confirm', 'simple', 'date', 'time', 'day']) {
          await tester.tap(find.byKey(Key(k)));
          await settle(tester);
          expectNoLayoutErrors(tester, 'con letra grande al abrir "$k"');
          await shoot(tester, 'tema_${mode.name}_${k}_grande');
          // Cierra tocando fuera (arriba a la izquierda, sobre la barrera).
          await tester.tapAt(const Offset(4, 30));
          await settle(tester, 4);
        }
      });

      testWidgets('la letra del sistema se limita a 1,3×', (tester) async {
        await pumpPhone(tester, const _Controls(), phone: Phone.small, theme: mode, textScale: 2);
        final scaler = MediaQuery.textScalerOf(tester.element(find.text('Controles')));
        expect(scaler.scale(10), closeTo(13, 0.01));
      });
    });
  }
}
