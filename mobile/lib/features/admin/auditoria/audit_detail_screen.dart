import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' show DateFormat;

import '../../../core/theme/app_theme.dart';
import '../admin_widgets.dart';
import 'audit_labels.dart';
import 'audit_models.dart';
import 'audit_providers.dart';

/// Detalle de un evento del registro: qué pasó, quién, cuándo y todos los
/// datos que guardó el sistema (traducidos; los crudos van al final, por si hay
/// que pasárselos a alguien). Se muestra enseguida con lo que ya trajo la lista
/// y se refresca con el detalle del servidor.
class AuditDetailScreen extends ConsumerWidget {
  const AuditDetailScreen({super.key, required this.entry});
  final AuditEntry entry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Si el servidor no responde, queda la versión de la lista (ya trae el detalle).
    final fresh = ref.watch(auditDetailProvider(entry.id)).value ?? entry;
    final c = context.hc;
    final kind = auditKindOf(fresh.action);
    final rows = auditDetailRows(fresh);

    return Scaffold(
      appBar: AppBar(title: const Text('Detalle del evento')),
      // SafeArea (2026-11-14, pedido de Ale): el final del detalle (los datos
      // crudos) quedaba debajo de la barra de gestos / de los tres botones.
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
          children: [
            AdminCard(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: kind.color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: Icon(kind.icon, color: kind.color, size: 25),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          auditActionLabel(fresh.action, serverLabel: fresh.actionLabel),
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16.5, height: 1.25),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _longDate(fresh.createdAt),
                          style: TextStyle(fontSize: 13, color: c.textDim),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const AdminSectionTitle('Quién'),
            AdminCard(
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: Brand.gold.withValues(alpha: 0.16),
                    child: Icon(
                      fresh.actor == null ? auditNoActorIcon(fresh.action, filled: true) : Icons.person_rounded,
                      color: Brand.gold,
                      size: 21,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fresh.actor == null ? auditNoActorName(fresh.action) : fresh.actor!.displayName,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                        ),
                        Text(
                          fresh.actor == null ? auditNoActorHint(fresh.action) : (fresh.actor!.roleLabel ?? 'Equipo'),
                          style: TextStyle(fontSize: 12.5, color: c.textDim),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (fresh.entityType != null) ...[
              const AdminSectionTitle('Sobre qué'),
              AdminCard(
                child: Column(
                  children: [
                    _KeyValue('Tipo', auditEntityLabel(fresh.entityType)),
                    if (fresh.entityId != null) _KeyValue('Identificador', fresh.entityId!, copyable: true),
                  ],
                ),
              ),
            ],
            const AdminSectionTitle('Detalle'),
            AdminCard(
              child: rows.isEmpty
                  ? Text('Este evento no guardó más datos.', style: TextStyle(color: c.textDim, fontSize: 13.5))
                  : Column(
                      children: [
                        for (final r in rows) _KeyValue(r.label, r.value),
                      ],
                    ),
            ),
            const AdminSectionTitle('Datos técnicos'),
            AdminCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _KeyValue('Código de la acción', fresh.action, copyable: true, mono: true),
                  _KeyValue('Id del evento', fresh.id, copyable: true, mono: true),
                  if (fresh.metadata != null) ...[
                    const SizedBox(height: 6),
                    Text('Datos tal como se guardaron',
                        style: TextStyle(fontSize: 12, color: c.textFaint, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: c.surface2,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: c.border),
                      ),
                      child: SelectableText(
                        fresh.prettyMetadata,
                        style: TextStyle(fontFamily: 'monospace', fontSize: 12, color: c.textDim, height: 1.4),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _longDate(DateTime d) {
  final day = DateFormat("EEEE d 'de' MMMM 'de' y", 'es_AR').format(d);
  final hour = DateFormat('HH:mm', 'es_AR').format(d);
  final cap = day.isEmpty ? day : '${day[0].toUpperCase()}${day.substring(1)}';
  return '$cap · $hour';
}

/// Fila "etiqueta · valor" (el valor se puede copiar con una pulsación larga o el ícono).
class _KeyValue extends StatelessWidget {
  const _KeyValue(this.label, this.value, {this.copyable = false, this.mono = false});
  final String label;
  final String value;
  final bool copyable;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: copyable ? 0 : 6),
      child: Row(
        crossAxisAlignment: copyable ? CrossAxisAlignment.center : CrossAxisAlignment.start,
        children: [
          SizedBox(
            // La columna de rótulos crece con la letra del sistema: a 112 dp
            // fijos, con letra grande "Identificador" se partía en dos.
            width: MediaQuery.textScalerOf(context).scale(112).clamp(112.0, 150.0),
            child: Text(label, style: TextStyle(fontSize: 12.5, color: c.textFaint, fontWeight: FontWeight.w600)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: mono ? 12.5 : 13.5,
                fontFamily: mono ? 'monospace' : null,
                fontWeight: FontWeight.w600,
                height: 1.3,
              ),
            ),
          ),
          if (copyable)
            // Botón de 44 dp (2026-11-14, pedido de Ale): antes el ícono de
            // copiar era un blanco de 22×17 dp, casi imposible de acertar.
            IconButton(
              tooltip: 'Copiar',
              iconSize: 17,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
              style: IconButton.styleFrom(tapTargetSize: MaterialTapTargetSize.shrinkWrap),
              color: c.textDim,
              icon: const Icon(Icons.copy_rounded),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: value));
                ScaffoldMessenger.of(context)
                  ..hideCurrentSnackBar()
                  ..showSnackBar(const SnackBar(content: Text('Copiado')));
              },
            ),
        ],
      ),
    );
  }
}
