# Editor Saucedo

Programa para Windows de **Saucedo Video y Fotografía**. Está hecho para que se use sin saber editar: se eligen fotos y videos, se escriben los nombres y el programa arma el resultado.

| Pestaña | Qué hace |
|---|---|
| **Fotos** | Botón "Mejorar colores", 6 estilos (Natural, Boda cálida, Rosa XV, Blanco y negro, Colores vivos, Película) y marca de agua con el logo. Guarda por lote en JPG al tamaño original. |
| **Save the Date** | Video de 20 a 40 s con fotos y clips, título "Save the Date" con nombres, cierre con la fecha y el lugar, música y logo. |
| **Videoclip XV** | Video del largo de la canción (o 1, 2 o 3 min) con portada "Mis XV", cierre con frase de agradecimiento, transiciones y logo. |
| **Película del evento** | La película completa de la fiesta, guiada por momentos (Llegada, Misa, Entrada, Vals, Brindis, Baile sorpresa, Fiesta, Despedida). Se recorta cada toma, se ajusta su sonido y se elige música por momento. |

Los videos salen en **vertical 1080 × 1920**, **horizontal 1920 × 1080** o los dos.

Todo se guarda en `Documentos\Saucedo\<fecha> <plantilla> <nombres>\`.

## Película del evento

1. **Evento:** nombre y fecha. El proyecto se guarda solo en `Documentos\Saucedo\<fecha> <nombre>\Película\proyecto-saucedo.json` y se puede abrir otro día.
2. **Material:** videos y fotos de la cámara y de los celulares. Se ordenan por la hora de grabación; si una cámara tenía otra hora, se corrige con ±1 h por carpeta. Las tomas separadas por más de 10 minutos quedan en grupos para mandarlas juntas a un momento.
3. **Revisión automática:** marca tomas en negro (tapa puesta), muy oscuras, muy cortas, muy largas, sin sonido y de celular vertical, y dice qué conviene hacer.
4. **Momentos:** cada uno trae una recomendación (por ejemplo, en el vals se deja el sonido original y sin música). Cada momento tiene volumen de las tomas, título de capítulo opcional y música que baja sola cuando alguien habla.
5. **Cada toma:** recorte con "Empieza aquí" / "Termina aquí", volumen de 0 a 150 % o sin sonido, y orden dentro del momento.
6. **Crear película:** portada, capítulos, créditos con el logo, transiciones (suaves, dinámicas o solo cortes), reducción de ruido del salón, volumen parejo en toda la película (−16 LUFS) y capítulos marcados en el MP4. Si se pausa o se apaga la computadora, al volver a crear sigue donde se quedó.

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
```

`tools/mock_server.py` y `tools/mock_tauri.js` imitan la parte nativa para probar la interfaz en un navegador normal.

## Licencias de terceros

- Letras: Great Vibes, Cormorant Garamond, Archivo y Atkinson Hyperlegible, todas con licencia SIL Open Font License 1.1.
- FFmpeg (compilación GPL de BtbN) se incluye como programa aparte dentro del instalador, bajo su propia licencia GPL.
