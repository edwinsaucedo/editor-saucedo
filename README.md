# Editor Saucedo

Programa para Windows de **Eduardo Saucedo · Video & Fotografía**. Está hecho para que se use sin saber editar: se eligen fotos y videos, se escriben los nombres y el programa arma el resultado.

| Pestaña | Qué hace |
|---|---|
| **Fotos** | Botón "Mejorar colores", 6 estilos (Natural, Boda cálida, Rosa XV, Blanco y negro, Colores vivos, Película) y el logo oficial como marca de agua. Guarda por lote en JPG al tamaño original. |
| **Plantillas de video** | 20 plantillas tipo CapCut, simples y elaboradas, con textos animados, efectos y cortes al ritmo de la canción. Vertical, horizontal y cuadrado. |
| **Película del evento** | La película completa de la fiesta, guiada por momentos, más un **resumen** de 3 a 5 min y un **reel** vertical armados solos con las mejores partes. |

**Logo:** viene de fábrica el logo oficial en negro y en blanco. En automático se pone negro sobre fondos claros y blanco sobre oscuros, foto por foto y toma por toma. Se puede subir otro logo.

Todo se guarda en `Documentos\Saucedo\<fecha> <plantilla o evento> <nombres>\`.

## Plantillas

| Plantilla | Tipo | Lo que la distingue |
|---|---|---|
| Save the Date clásico | Simple | Zoom lento, letra manuscrita, cierre con la fecha |
| Save the Date de cine | Elaborada | Barras de cine, grano, color cálido, nombres que se acomodan letra por letra |
| Save the Date moderno | Elaborada | "SAVE THE DATE" que rebota, cortes al ritmo, fecha en números grandes |
| Videoclip XV clásico | Simple | Portada "Mis XV", toda la canción, agradecimiento |
| XV neón | Elaborada | Letrero de neón que parpadea, destellos, colores intensos |
| Boda elegante | Simple | Nombres que se escriben solos, disolvencias lentas |
| Cuenta regresiva | Elaborada | "30 días para…" con rebote, cortes rápidos |
| Agradecimiento | Simple | Mensaje en máquina de escribir y firma |
| Bautizo o primera comunión | Simple | Colores claros, letra delicada |
| Cumpleaños | Elaborada | Confeti y letras que rebotan |
| Graduación | Simple | "Generación 2027" en dorado |
| Vlog del día | Simple | Título palabra por palabra, etiquetas, "REC", cortes directos |
| Vlog retro VHS | Elaborada | "PLAY", fecha de cámara vieja, colores corridos, ruido |
| Nostalgia 35 mm | Elaborada | Película antigua, grano, destellos de luz en los cortes |
| Impacto | Elaborada | Palabras que golpean la pantalla, cortes muy rápidos |
| Portada de revista | Elaborada | Nombre como título de revista, encabezados, código de barras |
| Álbum polaroid | Simple | Cada foto en una polaroid sobre papel |
| Minimal | Simple | Solo un título pequeño y fundidos |
| Promo del negocio | Elaborada | Anuncio con el logo, servicios y "Agenda tu fecha" |
| Antes y después | Elaborada | Cada foto sin editar y luego mejorada, con barrido |

Las plantillas están en `src/js/templates.js`: cada una es una receta (tiempos, transiciones, color, efectos) más sus diseños de texto, que se dibujan cuadro por cuadro y FFmpeg pone encima del video.

## Película del evento

1. **Evento:** nombre y fecha. El proyecto se guarda solo en `Documentos\Saucedo\<fecha> <nombre>\Película\proyecto-saucedo.json` y se puede abrir otro día.
2. **Material:** videos y fotos de la cámara y de los celulares. Se ordenan por la hora de grabación; si una cámara tenía otra hora, se corrige con ±1 h por carpeta. Las tomas separadas por más de 10 minutos quedan en grupos para mandarlas juntas a un momento.
3. **Revisión automática:** marca tomas en negro (tapa puesta), muy oscuras, muy cortas, muy largas, sin sonido y de celular vertical, y dice qué conviene hacer.
4. **Momentos:** cada uno trae una recomendación (por ejemplo, en el vals se deja el sonido original y sin música). Cada momento tiene volumen de las tomas, título de capítulo opcional y música que baja sola cuando alguien habla.
5. **Cada toma:** recorte con "Empieza aquí" / "Termina aquí", volumen de 0 a 150 % o sin sonido, y orden dentro del momento.
6. **Crear película:** portada, capítulos, créditos con el logo, transiciones (suaves, dinámicas o solo cortes), reducción de ruido del salón, volumen parejo en toda la película (−16 LUFS) y capítulos marcados en el MP4. Si se pausa o se apaga la computadora, al volver a crear sigue donde se quedó.
7. **Resumen y reel:** cada toma se revisa segundo a segundo (brillo, nitidez, movimiento y sonido, como aplausos) y se eligen las mejores partes de cada momento. Se cortan al ritmo de la canción, con el título al inicio, el nombre de cada momento y los créditos con el logo. El resumen sale horizontal (3, 4 o 5 min) y el reel vertical (30, 45 o 60 s). Nunca dura más que la canción, y si hay poco material sale más corto en lugar de repetir tomas.

## Instalar en la computadora

1. Entra a la sección **Releases** de este repositorio.
2. Descarga el archivo que termina en **`-setup.exe`** de la versión más reciente.
3. Ábrelo y sigue los pasos. No pide permisos de administrador.
4. Si aparece "Windows protegió su PC", da clic en **Más información › Ejecutar de todas formas**. Solo pasa la primera vez porque el instalador no está firmado.

Cada vez que se sube un cambio a `main`, GitHub genera un instalador nuevo en Releases. Para actualizar, se instala encima del anterior; el logo y los ajustes se conservan.

## Cómo está hecho

- **Tauri 2** para la ventana y el instalador (`src-tauri/`). La parte en Rust solo corre FFmpeg, lee y escribe archivos y abre las ventanas de Windows.
- **Interfaz** en HTML, CSS y JavaScript sin compilador (`src/`).
- **FFmpeg** va dentro del programa. GitHub lo descarga de [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) al compilar; no se guarda en el repositorio.
- **Exportación:** usa la tarjeta de video si encuentra una (NVIDIA, Intel o AMD) y si no, el procesador.

### Motor de video (`src/js/engine.js`)

Se trabaja por etapas para que un evento con muchos clips en 4K no se acabe la memoria:

1. **Tomas:** cada clip o foto se recorta al formato y se guarda como archivo temporal. Las fotos se preparan en la interfaz con el mismo color que la pestaña Fotos, y FFmpeg les da un acercamiento lento. Un clip horizontal en un video vertical lleva el fondo difuminado del mismo clip. Los videos entrelazados (por ejemplo `.MTS` de videocámara) se desentrelazan.
2. **Grupos:** con más de 12 tomas, se unen de 10 en 10 con sus transiciones.
3. **Final:** se unen los grupos y se agregan títulos, logo, música con entrada y salida suaves, y se exporta el MP4 (H.264 + AAC).

Los títulos se dibujan en la interfaz (Great Vibes, Cormorant Garamond y Archivo) como PNG transparentes, y FFmpeg los pone encima con desvanecido.

## Desarrollo

Requisitos: Node 22, Rust estable y, en Windows, las herramientas de compilación de Visual Studio.

```bash
npm ci
# Copia ffmpeg y ffprobe a src-tauri/binaries con el nombre de tu plataforma, por ejemplo:
#   ffmpeg-x86_64-pc-windows-msvc.exe y ffprobe-x86_64-pc-windows-msvc.exe
npm run dev        # abre el programa
npm run build      # crea el instalador
```

Pruebas del motor:

```bash
node tools/test-engine.mjs ./.prueba-motor --solo-plan   # revisa la lógica sin FFmpeg
node tools/test-engine.mjs ./.prueba-motor               # crea videos de prueba con FFmpeg del sistema
node tools/test-film.mjs ./.prueba-pelicula <material>     # película de prueba (necesita horizontal.mp4, vertical.mp4, hdv.mp4 y cancion.mp3)
node tools/test-templates.mjs ./.prueba-plantillas <material>   # ritmo, capas animadas, efectos y mejores momentos
```

`tools/mock_server.py` y `tools/mock_tauri.js` imitan la parte nativa para probar la interfaz en un navegador normal.

## Licencias de terceros

- Letras: Great Vibes, Cormorant Garamond, Archivo, Atkinson Hyperlegible y VT323, todas con licencia SIL Open Font License 1.1.
- FFmpeg (compilación GPL de BtbN) se incluye como programa aparte dentro del instalador, bajo su propia licencia GPL.
