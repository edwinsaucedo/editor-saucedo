# Editor Saucedo

Programa para Windows de **Eduardo Saucedo · Video & Fotografía**. Está hecho para que se use sin saber editar: se eligen fotos y videos, se escriben los nombres y el programa arma el resultado.

| Pestaña | Qué hace |
|---|---|
| **Fotos** | Botón "Mejorar colores", 6 estilos (Natural, Boda cálida, Rosa XV, Blanco y negro, Colores vivos, Película), ajustes finos (brillo, contraste, saturación, calidez) y el logo oficial como marca de agua. Todo se aplica a **todas las fotos o solo a una** (con giro y lugar del logo propio). Guarda por lote en JPG al tamaño original. |
| **Plantillas de video** | 30 plantillas tipo CapCut, simples y elaboradas, con textos animados, efectos y cortes al ritmo. Cada una ya trae su canción sugerida (se puede cambiar). Sombra de las letras a elegir. Vertical, horizontal y cuadrado. |
| **Fotosecuencia** | Fotos con movimiento y transiciones profesionales (automáticas o una por una), letras como en las plantillas, letreros por foto, música al ritmo y tres pesos de archivo. Se ve completa en la pantalla antes de crearla. |
| **Película del evento** | La película completa de la fiesta, guiada por momentos, más un **resumen** de 3 a 5 min y un **reel** vertical armados solos con las mejores partes. Con edición avanzada: tijeras, acortar la película a la duración que se pida, transición, velocidad, giro y color por toma. |

**Logo:** viene de fábrica el logo oficial en negro y en blanco. En automático se pone negro sobre fondos claros y blanco sobre oscuros, foto por foto y toma por toma. Tamaño chico, mediano o grande desde Fotos, Plantillas o Película (es el mismo ajuste en las tres). Se puede subir otro logo.

**Música incluida:** 14 canciones originales hechas para el programa (romántica, vals, de película, inspiradora, alegre, acústica, lo-fi, tierna, cumbia, electrónica, trap, retro 80s, navideña y ragtime). Se pueden subir a Facebook, Instagram, TikTok y YouTube sin reclamos de derechos. En la ventana de música se escucha la mejor parte con ▶ y se elige con "Usar"; también se puede usar una canción de la computadora.

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
| Feliz Navidad | Simple | Nieve que cae, destellos, letras doradas y el año nuevo |
| Fiesta mexicana | Elaborada | Papel picado que se mece, letras con contorno y rebote, cumbia |
| Revelación: ¿niño o niña? | Elaborada | Pregunta al inicio; al final cuenta 3, 2, 1 y revela con confeti rosa o azul |
| Fiesta infantil | Simple | Globos que suben, letras redondas, etiqueta con los años |
| Collage de recuerdos | Elaborada | Tres fotos a la vez con marco blanco (las fotos se juntan de 3 en 3) |
| Glitch digital | Elaborada | Letras que fallan, colores corridos e interferencia en cada corte |
| Letras al ritmo | Elaborada | La frase aparece palabra por palabra, una en cada corte |
| Subtítulos estilo CapCut | Simple | Cada toma con su frase en globo blanco (frases separadas con /) |
| Película antigua | Simple | Blanco y negro, parpadeo de proyector, letreros de cine mudo |
| Aniversario | Simple | "10 años" en grande, corazones que suben, nombres manuscritos |

Las plantillas están en `src/js/templates.js`: cada una es una receta (tiempos, transiciones, color, efectos, canciones sugeridas) más sus diseños de texto, que se dibujan cuadro por cuadro y FFmpeg pone encima del video. En videos cortos con música incluida, la canción empieza sola en su mejor parte (el coro) y los cortes caen exactos en el ritmo, porque el tempo de cada canción se conoce de fábrica.

## Película del evento

1. **Evento:** nombre y fecha. El proyecto se guarda solo en `Documentos\Saucedo\<fecha> <nombre>\Película\proyecto-saucedo.json` y se puede abrir otro día.
2. **Material:** videos y fotos de la cámara y de los celulares. Se ordenan por la hora de grabación; si una cámara tenía otra hora, se corrige con ±1 h por carpeta. Las tomas separadas por más de 10 minutos quedan en grupos para mandarlas juntas a un momento.
3. **Revisión automática:** marca tomas en negro (tapa puesta), muy oscuras, muy cortas, muy largas, sin sonido y de celular vertical, y dice qué conviene hacer.
4. **Momentos:** cada uno trae una recomendación (por ejemplo, en el vals se deja el sonido original y sin música). Cada momento tiene volumen de las tomas, título de capítulo opcional y música que baja sola cuando alguien habla.
5. **Cada toma:** recorte con "Empieza aquí" / "Termina aquí", volumen de 0 a 150 % o sin sonido, y orden dentro del momento.
6. **Crear película:** portada, capítulos, créditos con el logo, transiciones (suaves, dinámicas o solo cortes), reducción de ruido del salón, volumen parejo en toda la película (−16 LUFS) y capítulos marcados en el MP4. Calidad ligera 720p, normal 1080p o máxima 4K. Si se pausa o se apaga la computadora, al volver a crear sigue donde se quedó.

### Edición avanzada (Película)

- **✂ Cortar aquí** (tecla **S**): parte una toma en dos donde está el video. Cada pedazo se acomoda, recorta o quita por separado; en la barra se ven los otros pedazos del mismo archivo.
- **✂ Acortar la película…**: se elige cuánto debe durar (por ejemplo, de 4 h a 2 h) y el programa revisa cada toma segundo a segundo y quita primero lo oscuro, sin movimiento, sin sonido o fuera de foco. Cada toma conserva por lo menos 3 segundos y la ceremonia, el vals y el brindis no se tocan (se puede cambiar). Lo quitado queda en gris en la barra de cada toma: un clic lo regresa.
- **Opciones avanzadas de cada toma:** transición al empezar (18 tipos con muestra animada y duración rápida, normal o lenta), velocidad (0.5× cámara lenta a 2×), acercar (115 a 150 %), girar videos grabados de lado, color propio (brillo, contraste, saturación y calidez, o el mismo en todo el momento), estabilizar y un letrero en pantalla ("Los padrinos").
- **Doble toma:** otra toma (por ejemplo, la del dron) en un cuadro chico, mediano o grande en cualquier esquina, desde el segundo que se elija, con marco blanco y, si se quiere, con su sonido. Se ve en la vista previa al reproducir.
- **Transiciones a la vista:** en el tablero, entre toma y toma, se ve qué transición lleva; al tocarla se reproduce en grande con las imágenes reales de las dos tomas. Las muestras de cada transición también usan las tomas reales.
- **Opciones avanzadas del momento:** una transición para todas sus tomas y si se puede recortar o no.
- **Sombra de las letras** (como viene, suave, marcada o sin sombra) para los letreros, el resumen y el reel.
- **↶ Deshacer** (Ctrl+Z) para cualquier cambio, y atajos: I / O marcan inicio y fin, Espacio reproduce, Supr quita la toma.
- La duración de la película se ve siempre en la barra, ya con las partes quitadas, la velocidad y las transiciones.
7. **Resumen y reel:** cada toma se revisa segundo a segundo (brillo, nitidez, movimiento y sonido, como aplausos) y se eligen las mejores partes de cada momento. Se cortan al ritmo de la canción, con el título al inicio, el nombre de cada momento y los créditos con el logo. El resumen sale horizontal (3, 4 o 5 min) y el reel vertical (30, 45 o 60 s). Nunca dura más que la canción, y si hay poco material sale más corto en lugar de repetir tomas.

## Fotosecuencia

1. **Fotos:** se agregan o se arrastran; se ordenan como se agregaron o por nombre (como salen de la cámara), y se mueven con ‹ Antes / Después ›.
2. **Letras:** 12 diseños de las plantillas (Elegante, De cine, Nostalgia, Delicado, Máquina de escribir, Minimal, Neón, Fiesta, Mexicana, Impacto, Navidad, Glitch) o sin letras; título al inicio y despedida al final, color y sombra. Cada foto puede llevar su letrero (elegante o en globo tipo CapCut).
3. **Transiciones y movimiento:** estilos automáticos (Suave, Elegante, Dinámica o Solo cortes) y, foto por foto, cualquiera de las 18 transiciones con su duración, movimiento (acercar, alejar, recorrer hacia un lado o quieta) y cuánto dura. Entre foto y foto se ve la transición; al tocarla se reproduce ese momento.
4. **Música:** canciones incluidas (empieza sola en la mejor parte), cambio de foto al ritmo y opción de que dure toda la canción.
5. **Crear:** horizontal, vertical o cuadrado; peso Ligero (720p, para WhatsApp), Normal (1080p) o Alta calidad. Las fotos se preparan una sola vez al tamaño del video para que FFmpeg trabaje ligero.

## Música incluida (`tools/musica/`)

Las 14 canciones se componen en código (acordes, melodías, baterías y bajos en `tools/musica/canciones/`), se tocan con el banco de sonidos **GeneralUser GS** de S. Christian Collins (su licencia permite usarlo para hacer música, incluso comercial) y se mezclan y masterizan en Python: ecualización, reverberación de sala, compresión lateral en la electrónica, balance tonal por género y −14 LUFS con picos de −1 dB. Para volver a generarlas:

```bash
pip install mido pyloudnorm numpy scipy
SAUCEDO_SF2=/ruta/GeneralUser-GS.sf2 python3 tools/musica/producir.py      # todas
SAUCEDO_SF2=/ruta/GeneralUser-GS.sf2 python3 tools/musica/producir.py brillar
```

Se guardan en `src-tauri/musica/*.mp3` (se instalan junto al programa) y sus datos (nombre, ánimo, tempo, compás, coro y secciones) en `src/js/musica-data.js`. "Cascabeles" es un arreglo nuevo de *Jingle Bells* (James Lord Pierpont, 1857), que es de dominio público.

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

1. **Tomas:** cada clip o foto se recorta al formato y se guarda como archivo temporal (una toma con partes quitadas se guarda en pedazos, unidos después con un fundido muy corto). Las fotos se preparan en la interfaz con el mismo color que la pestaña Fotos, y FFmpeg les da un acercamiento lento. Un clip horizontal en un video vertical lleva el fondo difuminado del mismo clip. Los videos entrelazados (por ejemplo `.MTS` de videocámara) se desentrelazan.
2. **Grupos:** con más de 12 tomas, se unen de 10 en 10 con sus transiciones (en 4K de 3 en 3, porque cada toma ocupa 4 veces más memoria al unirla).
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
- Música: composiciones originales de este proyecto, tocadas con GeneralUser GS (S. Christian Collins), cuya licencia permite usarlo sin restricción para crear música privada o comercial.
