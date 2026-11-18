import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import '../filamentos/shared_widgets.dart';
import 'consultas_models.dart';

/// Plata de una consulta, igual que en el resto de la app ($12.500).
String formatConsultaMoney(num v) => formatPrice(v);

/// Renglones del resumen de precio de una respuesta:
///  • una unidad:   "Precio: $12.500"
///  • varias:       "Precio: $12.500 c/u" y "Total (12 unidades): $150.000"
///  • por cantidad: "Desde 50 unidades: $10.000 c/u"
List<String> consultaPriceLines(Consulta q) {
  final price = q.unitPrice;
  if (price == null) return const [];
  final total = q.total;
  return [
    total == null ? 'Precio: ${formatConsultaMoney(price)}' : 'Precio: ${formatConsultaMoney(price)} c/u',
    if (total != null) 'Total (${q.quantity} unidades): ${formatConsultaMoney(total)}',
    if (q.bulkPrice != null && q.bulkFrom != null)
      'Desde ${q.bulkFrom} unidades: ${formatConsultaMoney(q.bulkPrice!)} c/u',
  ];
}

/// La respuesta de una consulta: resumen de precio, quién respondió, el
/// mensaje para el cliente y los botones para copiarlo o mandarlo por
/// WhatsApp. No dibuja nada si la consulta todavía no tiene mensaje.
class ConsultaMessageBlock extends StatelessWidget {
  const ConsultaMessageBlock({super.key, required this.consulta, this.expanded = false});
  final Consulta consulta;

  /// Mensaje entero (pantalla de resultado) en vez de recortado con "Ver más".
  final bool expanded;

  Future<void> _copy(BuildContext context, String message) async {
    await Clipboard.setData(ClipboardData(text: message));
    if (context.mounted) showToast(context, 'Mensaje copiado');
  }

  Future<void> _whatsapp(BuildContext context, String message) async {
    // Con teléfono abre el chat del cliente; sin teléfono, WhatsApp deja elegir a quién.
    final ok = await openWhatsapp(consulta.customerPhone, message);
    if (!ok && context.mounted) showToast(context, 'No pudimos abrir WhatsApp.');
  }

  @override
  Widget build(BuildContext context) {
    final message = consulta.message;
    if (message == null) return const SizedBox.shrink();
    final c = context.hc;
    final q = consulta;
    final lines = consultaPriceLines(q);
    final who = [
      if (q.answeredBy != null) 'Respondió ${q.answeredBy}',
      if (q.answeredAt != null) formatDateTime(q.answeredAt!),
    ].join(' · ');
    final messageStyle = TextStyle(fontSize: 13.5, color: c.text, height: 1.4);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('Respuesta'),
          const SizedBox(height: 6),
          for (final (i, line) in lines.indexed)
            Text(
              line,
              style: TextStyle(
                // El primer renglón (el precio) es lo que más se mira.
                fontWeight: i == 0 ? FontWeight.w800 : FontWeight.w600,
                fontSize: i == 0 ? 15 : 13,
                color: i == 0 ? Brand.gold : c.text,
                height: 1.35,
              ),
            ),
          if (who.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(who, style: TextStyle(fontSize: 11.5, color: c.textFaint)),
          ],
          const SizedBox(height: 10),
          Divider(height: 1, color: c.border),
          const SizedBox(height: 10),
          if (expanded)
            SelectableText(message, style: messageStyle)
          else
            ExpandableText(message, collapsedLines: 8, style: messageStyle),
          const SizedBox(height: 10),
          // Wrap: con letra grande en un teléfono angosto el segundo botón
          // baja de renglón en vez de desbordar.
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              OutlinedButton.icon(
                onPressed: () => _copy(context, message),
                icon: const Icon(Icons.copy_rounded, size: 18),
                label: const Text('Copiar mensaje'),
              ),
              OutlinedButton.icon(
                onPressed: () => _whatsapp(context, message),
                icon: const Icon(Icons.send_rounded, size: 18),
                label: const Text('WhatsApp'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
