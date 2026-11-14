// Formato y parseo de números a la argentina ($1.234,50). Lo usan los formularios
// de Reportes, Ganancias y Calculadora: si esto falla, un precio puede quedar
// 1000 veces mal, así que se prueba a fondo.

import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/analisis/ar_number.dart';

void main() {
  group('formatArNumber', () {
    test('miles con punto y decimales con coma', () {
      expect(formatArNumber(1234.5), '1.234,5');
      expect(formatArNumber(1234567.891), '1.234.567,89');
      expect(formatArNumber(1000), '1.000');
      expect(formatArNumber(999), '999');
      expect(formatArNumber(0.5), '0,5');
    });

    test('decimales mínimos y máximos', () {
      expect(formatArNumber(12, minDecimals: 2), '12,00');
      expect(formatArNumber(12.3456, maxDecimals: 3), '12,346');
      expect(formatArNumber(12.5, maxDecimals: 0), '13');
      expect(formatArNumber(999.999), '1.000'); // redondea y agrupa
    });

    test('negativos y ceros sin signo raro', () {
      expect(formatArNumber(-1234.5), '-1.234,5');
      expect(formatArNumber(-0.001), '0');
      expect(formatArNumber(0), '0');
    });

    test('NaN e infinito no rompen', () {
      expect(formatArNumber(double.nan), '0');
      expect(formatArNumber(double.infinity), '0');
    });
  });

  group('formatArMoney', () {
    test('por defecto dos decimales', () {
      expect(formatArMoney(1234.5), '\$1.234,50');
      expect(formatArMoney(0), '\$0,00');
      expect(formatArMoney(3086.25), '\$3.086,25');
      expect(formatArMoney(0.006), '\$0,01');
    });

    test('sin decimales (como el precio de la tienda)', () {
      expect(formatArMoney(20000, decimals: 0), '\$20.000');
      expect(formatArMoney(32500.4, decimals: 0), '\$32.500');
    });

    test('negativos', () {
      expect(formatArMoney(-5.5), '-\$5,50');
      expect(formatArMoney(-0.0001), '\$0,00');
    });
  });

  group('formatos cortos', () {
    test('porcentaje', () {
      expect(formatArPercent(12.5), '12,5%');
      expect(formatArPercent(100), '100%');
      expect(formatArPercent(33.333, maxDecimals: 2), '33,33%');
    });

    test('monto compacto para ejes', () {
      expect(formatArCompactMoney(850), '\$850');
      expect(formatArCompactMoney(9999), '\$9.999');
      expect(formatArCompactMoney(12500), '\$12,5 mil');
      expect(formatArCompactMoney(1200000), '\$1,2 M');
      expect(formatArCompactMoney(-2500000), '-\$2,5 M');
    });
  });

  group('parseArNumber', () {
    test('formato argentino completo', () {
      expect(parseArNumber('1.234,5'), 1234.5);
      expect(parseArNumber('12.345,67'), 12345.67);
      expect(parseArNumber('2,5'), 2.5);
      expect(parseArNumber('1.234.567'), 1234567);
      expect(parseArNumber('100'), 100);
      expect(parseArNumber('0,75'), 0.75);
    });

    test('punto como decimal (teclados que escriben ".")', () {
      expect(parseArNumber('2.5'), 2.5);
      expect(parseArNumber('0.75'), 0.75);
      expect(parseArNumber('12.50'), 12.5);
    });

    test('un punto con 3 dígitos detrás es de miles (convención argentina)', () {
      expect(parseArNumber('25.000'), 25000);
      expect(parseArNumber('1.500'), 1500);
    });

    test('después de un 0 el punto solo puede ser decimal', () {
      expect(parseArNumber('0.250'), 0.25);
    });

    test('ignora \$, %, espacios y espacios duros', () {
      expect(parseArNumber('\$ 1.500,75'), 1500.75);
      expect(parseArNumber('10 %'), 10);
      expect(parseArNumber('  42  '), 42);
      expect(parseArNumber('1 000,5'), 1000.5);
    });

    test('puntas sueltas mientras se tipea', () {
      expect(parseArNumber(',5'), 0.5);
      expect(parseArNumber('5,'), 5);
    });

    test('negativos', () {
      expect(parseArNumber('-5,5'), -5.5);
    });

    test('lo que no se entiende da null (nunca se adivina)', () {
      expect(parseArNumber(''), isNull);
      expect(parseArNumber('   '), isNull);
      expect(parseArNumber('abc'), isNull);
      expect(parseArNumber('-'), isNull);
      expect(parseArNumber('1,234.5'), isNull, reason: 'formato inglés');
      expect(parseArNumber('1,2,3'), isNull);
      expect(parseArNumber('12.5.3'), isNull);
      expect(parseArNumber('1.2345,5'), isNull, reason: 'miles mal agrupados');
      expect(parseArNumber('1.23,4'), isNull);
      expect(parseArNumber('1234567890123456'), isNull, reason: 'demasiados dígitos');
    });

    test('ida y vuelta: formatear y volver a parsear da lo mismo', () {
      for (final v in [0.0, 0.5, 12.0, 999.0, 1000.0, 1234.5, 25000.0, 1234567.89, 3086.25]) {
        expect(parseArNumber(formatArNumber(v)), closeTo(v, 0.0001), reason: 'valor $v');
        expect(parseArNumber(formatArMoney(v)), closeTo(v, 0.0001), reason: 'dinero $v');
      }
    });
  });

  group('validateArNumber', () {
    test('requerido', () {
      expect(validateArNumber(''), 'Ingresá un número.');
      expect(validateArNumber('   '), 'Ingresá un número.');
      expect(validateArNumber('', required: false), isNull);
      expect(validateArNumber(null, required: false), isNull);
    });

    test('número válido', () {
      expect(validateArNumber('1.234,50'), isNull);
      expect(validateArNumber('0'), isNull);
    });

    test('número inválido', () {
      expect(validateArNumber('abc'), 'No entiendo ese número. Ejemplo: 1.234,50');
      expect(validateArNumber('1,234.5'), 'No entiendo ese número. Ejemplo: 1.234,50');
    });

    test('mínimos y máximos', () {
      expect(validateArNumber('-1', min: 0), 'No puede ser negativo.');
      expect(validateArNumber('0', min: 1), 'Mínimo 1.');
      expect(validateArNumber('101', max: 100), 'Máximo 100.');
      expect(validateArNumber('100', max: 100), isNull);
      expect(validateArNumber('60', max: 59), 'Máximo 59.');
    });

    test('enteros', () {
      expect(validateArNumber('2,5', integer: true), 'Tiene que ser un número entero.');
      expect(validateArNumber('220', integer: true), isNull);
      expect(validateArNumber('8.000', integer: true), isNull, reason: '8.000 = ocho mil');
    });

    test('cantidad de decimales', () {
      expect(validateArNumber('1,234'), 'Máximo 2 decimales.');
      expect(validateArNumber('1,23'), isNull);
      expect(validateArNumber('1,5', maxDecimals: 0), 'Sin decimales.');
    });
  });

  group('ArNumberInputFormatter', () {
    TextEditingValue ed(String t) => TextEditingValue(text: t);
    String run(ArNumberInputFormatter f, String from, String to) =>
        f.formatEditUpdate(ed(from), ed(to)).text;

    test('acepta dígitos, puntos y una coma', () {
      final f = ArNumberInputFormatter();
      expect(run(f, '12', '12,'), '12,');
      expect(run(f, '12,', '12,5'), '12,5');
      expect(run(f, '1', '1.'), '1.');
      expect(run(f, '', '1.234,5'), '1.234,5');
    });

    test('rechaza letras, espacios y símbolos', () {
      final f = ArNumberInputFormatter();
      expect(run(f, '12', '12a'), '12');
      expect(run(f, '12', '12 '), '12');
      expect(run(f, '12', '12\$'), '12');
      expect(run(f, '12', '12-'), '12', reason: 'sin negativos por defecto');
    });

    test('una sola coma y decimales limitados', () {
      final f = ArNumberInputFormatter(maxDecimals: 2);
      expect(run(f, '1,2', '1,2,'), '1,2');
      expect(run(f, '1,23', '1,234'), '1,23');
      expect(run(f, '1,5', '1,5.'), '1,5');
    });

    test('enteros: no deja escribir decimales', () {
      final f = ArNumberInputFormatter(maxDecimals: 0);
      expect(run(f, '12', '12,5'), '12');
      expect(run(f, '12', '12,'), '12,');
    });

    test('negativos si se permiten', () {
      final f = ArNumberInputFormatter(allowNegative: true);
      expect(run(f, '', '-5'), '-5');
    });
  });
}
