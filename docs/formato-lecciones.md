# Cómo crear una lección para MakerLab

Una lección es una carpeta con un archivo `leccion.json`. Para crear una nueva:

1. En MakerLab, menú **⋯ → Abrir carpeta de lecciones**.
2. Copiá ahí una carpeta de lección existente (por ejemplo, desde
   `wwwroot/lecciones/03-algoritmos`) y cambiale el nombre.
3. Editá `leccion.json` con el Bloc de notas y volvé a abrir MakerLab.

Para compartirla con otro docente, comprimí la carpeta en un `.zip`. El otro
docente la incorpora con **⋯ → Importar lección (.zip)**.

## Campos de `leccion.json`

| Campo | Obligatorio | Descripción |
|---|---|---|
| `formato` | sí | Siempre `"makerlab-leccion"`. |
| `version` | no | Versión del formato (hoy, `1`). |
| `id` | sí | Identificador único: minúsculas, números y guiones. Ej.: `"11-laberinto"`. |
| `orden` | no | Número para ordenar la lista de lecciones. |
| `titulo` | sí | Nombre que ve el estudiante. |
| `autor` | no | Quién creó la lección. |
| `objetivo` | no | Objetivo pedagógico (para el docente). |
| `consigna` | no | Texto que ve el estudiante. |
| `pistas` | no | Lista de pistas que se muestran a pedido. |
| `bloques` | sí | Bloques disponibles en la lección (ver tabla). |
| `escenario` | no | Pista del simulador (ver abajo). |
| `programaInicial` | no | Bloques con los que empieza la lección (formato de Blockly). |

### Bloques disponibles

| Valor | Bloque |
|---|---|
| `dave_paso` | avanzar / retroceder / girar un paso |
| `dave_mover`, `dave_detener` | encender motores / detenerse |
| `dave_esperar` | esperar N segundos |
| `controls_repeat_ext` | repetir N veces |
| `dave_siempre` | repetir para siempre |
| `controls_whileUntil` | repetir mientras / hasta |
| `dave_si`, `dave_si_sino` | si… / si… si no (sin engranaje) |
| `dave_segun` | según el valor de… (tres casos y "en cualquier otro caso") |
| `dave_led`, `dave_sonido` | luces y buzzer |
| `dave_esperar_boton`, `dave_boton`, `dave_boton_numero` | botones |
| `dave_obstaculo`, `dave_distancia` | sensor ultrasónico |
| `dave_linea` | sensores de línea |
| `logic_compare`, `logic_operation`, `logic_negate`, `logic_boolean` | lógica |
| `math_number`, `math_arithmetic` | números |
| `variables` | categoría de variables |

### Escenario

Todas las medidas están en centímetros. La pista mide por defecto 320 × 210 cm
y el origen (0, 0) es la esquina superior izquierda.

```json
"escenario": {
  "ancho": 320, "alto": 210,
  "robot": { "x": 40, "y": 105, "angulo": 0 },
  "meta": { "x": 280, "y": 105, "radio": 12, "detenerse": true, "texto": "META" },
  "marcas": [ { "x": 40, "y": 105, "texto": "A" } ],
  "obstaculos": [ { "x": 150, "y": 40, "ancho": 20, "alto": 130 } ],
  "lineas": [ [[20, 190], [300, 190]] ],
  "anchoLinea": 3
}
```

- `angulo`: 0 mira a la derecha, 90 hacia abajo, -90 hacia arriba, 180 a la izquierda.
- `meta.detenerse`: si es `true`, DAVE tiene que frenar dentro de la meta; si no, alcanza con pasar por ella.
- `lineas`: cada línea es una lista de puntos que se unen con una cinta negra.

Las lecciones escritas con los nombres anteriores `controls_if` y `controls_if_else` siguen funcionando: MakerLab los reemplaza por `dave_si` y `dave_si_sino`.
