import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../admin_widgets.dart';
import 'config_models.dart';
import 'config_widgets.dart';
import 'textos_editors.dart';

/// Textos clave: lo que se lee en la tienda (banda de confianza y preguntas
/// frecuentes) y el formato de la cotización por WhatsApp. Cada uno se edita y
/// guarda por separado.
class TextosScreen extends StatelessWidget {
  const TextosScreen({super.key, required this.initial, required this.canEdit, required this.canEditQuote});
  final TextosConfig initial;
  final bool canEdit;

  /// La cotización la edita quien puede editar productos o pedidos (igual que la web).
  final bool canEditQuote;

  void _open(BuildContext context, Widget screen) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Scaffold(
      appBar: AppBar(title: const Text('Textos clave')),
      // SafeArea (2026-11-14, pedido de Ale): con letra grande la nota del
      // final quedaba debajo de la barra del sistema.
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
          children: [
            const ConfigHint('Elegí qué texto querés cambiar. Cada uno se guarda por separado.'),
            _TextTile(
              icon: Icons.verified_user_rounded,
              title: 'Banda de confianza',
              summary: initial.trustBar.isEmpty
                  ? 'Los puntos que se ven bajo el banner del inicio'
                  : initial.trustBar.map((t) => t.t).where((t) => t.isNotEmpty).join(' · '),
              tag: initial.trustBarCustom ? null : 'De fábrica',
              onTap: () => _open(context, TrustBarScreen(initial: initial.trustBar, canEdit: canEdit)),
            ),
            const SizedBox(height: 10),
            _TextTile(
              icon: Icons.help_outline_rounded,
              title: 'Preguntas frecuentes',
              summary: '${initial.faq.length} pregunta${initial.faq.length == 1 ? '' : 's'} en el inicio',
              tag: initial.faqCustom ? null : 'De fábrica',
              onTap: () => _open(context, FaqScreen(initial: initial.faq, canEdit: canEdit)),
            ),
            const SizedBox(height: 10),
            _TextTile(
              icon: Icons.request_quote_rounded,
              title: 'Cotización por WhatsApp',
              summary: 'Encabezado, seña y aclaraciones del mensaje',
              onTap: () => _open(context, QuoteScreen(initial: initial.quote, canEdit: canEditQuote)),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Text(
                'Lo marcado "De fábrica" es el texto que trae la tienda: al guardar pasa a ser el tuyo.',
                style: TextStyle(fontSize: 12, color: c.textFaint, height: 1.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TextTile extends StatelessWidget {
  const _TextTile({required this.icon, required this.title, required this.summary, required this.onTap, this.tag});
  final IconData icon;
  final String title;
  final String summary;
  final String? tag;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: Brand.gold.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(14)),
            child: Icon(icon, color: Brand.gold, size: 23),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
                    if (tag != null) ...[
                      const SizedBox(width: 8),
                      MiniTag(tag!),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  summary,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.3),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: c.textFaint),
        ],
      ),
    );
  }
}
