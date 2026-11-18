// Modales de toda la app: hojas inferiores, selector de día y de hora.
//
// Regla (2026-11-14, pedido de Ale: "que cuando tocás los botones se vean bien
// los modales"): TODA hoja inferior se abre con [showAppSheet] y arma su
// contenido con [SheetBody]. Así, en cualquier teléfono:
//   • la hoja nunca se mete debajo de la barra de estado / notch;
//   • el contenido sube con el teclado y el botón principal queda a la vista;
//   • si no entra, se desplaza (nunca franjas amarillas de desborde);
//   • abajo respeta la barra de gestos del sistema.

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Abre una hoja inferior con el comportamiento estándar de la app.
///
/// El contenido que devuelve [builder] tiene que ser un [SheetBody] (o, si es
/// una lista con buscador, usar [sheetBottomInset] para su margen inferior).
Future<T?> showAppSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool dragHandle = true,
  bool dismissible = true,
}) =>
    showModalBottomSheet<T>(
      context: context,
      // Alto libre (hasta toda la pantalla) y nunca debajo del notch.
      isScrollControlled: true,
      useSafeArea: true,
      // Sobre TODA la pantalla, también en las pestañas (inicio, catálogo,
      // ventas, cola): si no, la barra de pestañas quedaba a la vista y se
      // podía cambiar de pestaña con la hoja abierta.
      useRootNavigator: true,
      showDragHandle: dragHandle,
      isDismissible: dismissible,
      enableDrag: dismissible,
      builder: builder,
    );

/// Espacio a dejar debajo del contenido de una hoja: el teclado si está
/// abierto, o la barra de gestos del sistema si está cerrado.
double sheetBottomInset(BuildContext context) =>
    MediaQuery.viewInsetsOf(context).bottom + MediaQuery.paddingOf(context).bottom;

/// Contenido estándar de una hoja inferior.
///
/// [children] se desplazan si no entran; [footer] (el botón principal) queda
/// fijo abajo, siempre a la vista, pegado arriba del teclado cuando se abre.
class SheetBody extends StatelessWidget {
  const SheetBody({
    super.key,
    this.title,
    this.subtitle,
    required this.children,
    this.footer,
    this.padding = const EdgeInsets.symmetric(horizontal: 20),
  });

  final String? title;
  final String? subtitle;
  final List<Widget> children;

  /// Acción principal, fija abajo.
  final Widget? footer;

  /// Margen lateral del contenido.
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Padding(
      padding: EdgeInsets.only(bottom: sheetBottomInset(context)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Flexible(
            child: SingleChildScrollView(
              padding: padding.copyWith(top: 0, bottom: footer == null ? 20 : 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (title != null)
                    Text(title!, style: Theme.of(context).textTheme.titleLarge),
                  if (subtitle != null) ...[
                    const SizedBox(height: 4),
                    Text(subtitle!, style: TextStyle(fontSize: 13, color: c.textDim, height: 1.35)),
                  ],
                  if (title != null || subtitle != null) const SizedBox(height: 16),
                  ...children,
                ],
              ),
            ),
          ),
          if (footer != null)
            Padding(
              padding: EdgeInsets.fromLTRB(padding.left, 8, padding.right, 16),
              child: footer,
            ),
        ],
      ),
    );
  }
}

/// Selector de hora (reloj de 24 h) con los textos de la app.
Future<TimeOfDay?> pickTime(
  BuildContext context, {
  required TimeOfDay initial,
  String title = 'Elegí la hora',
}) =>
    showTimePicker(
      context: context,
      initialTime: initial,
      helpText: title,
      cancelText: 'Cancelar',
      confirmText: 'Aceptar',
      hourLabelText: 'Hora',
      minuteLabelText: 'Minutos',
      errorInvalidText: 'Ingresá una hora válida',
      builder: (ctx, child) => MediaQuery(
        data: MediaQuery.of(ctx).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );

/// Selector de día de la app (mismo calendario en todos los módulos).
/// Devuelve el día elegido a medianoche local, o null si se cancela.
Future<DateTime?> pickDay(
  BuildContext context, {
  DateTime? initial,
  DateTime? first,
  DateTime? last,
  String title = 'Elegí una fecha',
}) {
  final now = DateTime.now();
  final from = first ?? DateTime(now.year - 1);
  final to = last ?? DateTime(now.year + 10, 12, 31);
  var start = initial ?? now;
  // Un día inicial fuera de rango dejaría el calendario en un mes sin días
  // elegibles: se acerca al borde más próximo.
  if (start.isBefore(from)) start = from;
  if (start.isAfter(to)) start = to;
  return showDialog<DateTime>(
    context: context,
    builder: (_) => _DayPickerDialog(title: title, initial: start, first: from, last: to),
  );
}

class _DayPickerDialog extends StatefulWidget {
  const _DayPickerDialog({
    required this.title,
    required this.initial,
    required this.first,
    required this.last,
  });
  final String title;
  final DateTime initial;
  final DateTime first;
  final DateTime last;

  @override
  State<_DayPickerDialog> createState() => _DayPickerDialogState();
}

class _DayPickerDialogState extends State<_DayPickerDialog> {
  late DateTime _month = DateTime(widget.initial.year, widget.initial.month);
  late DateTime _selected = DateTime(widget.initial.year, widget.initial.month, widget.initial.day);

  static const _weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  static const _months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  bool _inRange(DateTime d) {
    final day = DateTime(d.year, d.month, d.day);
    return !day.isBefore(DateTime(widget.first.year, widget.first.month, widget.first.day)) &&
        !day.isAfter(DateTime(widget.last.year, widget.last.month, widget.last.day));
  }

  void _go(int delta) => setState(() => _month = DateTime(_month.year, _month.month + delta));

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final today = DateTime.now();
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final lead = DateTime(_month.year, _month.month).weekday - 1; // lunes = 0
    final cells = <int?>[
      for (var i = 0; i < lead; i++) null,
      for (var d = 1; d <= daysInMonth; d++) d,
    ];
    while (cells.length % 7 != 0) {
      cells.add(null);
    }
    final canPrev = DateTime(_month.year, _month.month).isAfter(DateTime(widget.first.year, widget.first.month));
    final canNext = DateTime(_month.year, _month.month).isBefore(DateTime(widget.last.year, widget.last.month));
    final monthName = _months[_month.month - 1];

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      // Con letra grande en un teléfono bajo el calendario no entra entero:
      // se desplaza en vez de desbordarse.
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(widget.title, style: Theme.of(context).textTheme.titleMedium),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                IconButton(
                  tooltip: 'Mes anterior',
                  onPressed: canPrev ? () => _go(-1) : null,
                  icon: const Icon(Icons.chevron_left_rounded),
                ),
                Expanded(
                  child: Text(
                    '${monthName[0].toUpperCase()}${monthName.substring(1)} ${_month.year}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
                IconButton(
                  tooltip: 'Mes siguiente',
                  onPressed: canNext ? () => _go(1) : null,
                  icon: const Icon(Icons.chevron_right_rounded),
                ),
              ],
            ),
            Row(
              children: [
                for (final w in _weekdays)
                  Expanded(
                    child: Center(
                      child: Text(w, style: TextStyle(fontSize: 12, color: c.textFaint, fontWeight: FontWeight.w700)),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            for (var row = 0; row < cells.length ~/ 7; row++)
              Row(
                children: [
                  for (var col = 0; col < 7; col++)
                    Expanded(child: _cell(c, cells[row * 7 + col], today)),
                ],
              ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(_selected),
                  child: const Text('Aceptar'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _cell(HefestoColors c, int? day, DateTime today) {
    if (day == null) return const SizedBox(height: 40);
    final date = DateTime(_month.year, _month.month, day);
    final selected = date == _selected;
    final isToday = date.year == today.year && date.month == today.month && date.day == today.day;
    final enabled = _inRange(date);
    return SizedBox(
      height: 40,
      child: Center(
        child: InkResponse(
          onTap: enabled ? () => setState(() => _selected = date) : null,
          child: Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: selected ? Brand.goldGradient : null,
              shape: BoxShape.circle,
              border: !selected && isToday ? Border.all(color: Brand.gold) : null,
            ),
            child: Text(
              '$day',
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                color: selected ? Brand.goldFg : (enabled ? c.text : c.textFaint),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
