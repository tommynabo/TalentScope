# Guía de Configuración Oauth 2.0 (Google Cloud Console) para TalentScope

Esta guía paso a paso te enseñará cómo configurar tu proyecto en Google Cloud para poder conceder permisos y enviar correos mediante la API de Gmail dentro de TalentScope.

## Paso 1: Crear un Proyecto
1. Ve a [Google Cloud Console](https://console.cloud.google.com/).
2. En la parte superior izquierda, junto al logo de Google Cloud, haz clic en el selector de proyectos y luego en **"Nuevo Proyecto"**.
3. Ponle de nombre `TalentScope Outreach` y dale a **"Crear"**.
4. Una vez creado, selecciónalo en el desplegable superior para empezar a trabajar en él.

## Paso 2: Habilitar la API de Gmail
1. En el menú de hamburguesa (arriba a la izquierda), ve a **"API y Servicios"** -> **"Biblioteca"**.
2. En el buscador, busca `Gmail API`.
3. Haz clic en "Gmail API" y pulsa en el botón azul de **"Habilitar"**.

## Paso 3: Configurar la Pantalla de Consentimiento OAuth
Esta es la pantalla "TalentScope quiere acceder a..." que le aparecerá a los usuarios cuando cliquen en conectar cuenta.

1. Ve a **"API y Servicios"** -> **"Pantalla de consentimiento de OAuth"**.
2. Tipo de usuario: Elige **"Externo"** (para que cualquier cuenta de @gmail.com pueda conectarse, no solo las de tu empresa). Dale a "Crear".
3. Rellena la información básica:
   - Nombre de la aplicación: `TalentScope`
   - Correo de asistencia: `tu-email@gmail.com`
   - Información de contacto del desarrollador: `tu-email@gmail.com`
   - (El resto déjalo vacío) y dale a **"Guardar y Continuar"**.
4. **Permisos (Scopes):** Esto es crucial. Dale a "Añadir o quitar permisos".
   - Busca y marca la casilla que dice `https://www.googleapis.com/auth/gmail.send`. (Esto nos permitirá *enviar* correos, pero no borrarlos ni leer todos los correos del usuario).
   - Dale a "Actualizar" y luego "Guardar y Continuar".
5. **Usuarios de prueba:** Mientras la app no esté verificada por Google (un proceso algo largo), solo los correos que añadas en esta lista podrán usar el sistema de enviar emails.
   - Añade tu correo y los 4 o 5 correos desde los que quieres enviar (ej: *tomas.recruiter1@gmail.com*).
   - Dale a "Guardar y Continuar".

## Paso 4: Crear las Credenciales (El "Client ID")
1. Ve a **"API y Servicios"** -> **"Credenciales"**.
2. Haz clic en **"Crear Credenciales"** y elige **"ID de cliente de OAuth"**.
3. Tipo de aplicación: Elige **"Aplicación web"**.
4. Nombre: `TalentScope Vercel App`
5. **Orígenes de JavaScript autorizados:** Añade la URL de tu frontend.
   - `http://localhost:5173` (para probar en local)
   - `https://tu-proyecto.vercel.app` (la URL de TalentScope en producción).
6. **URI de redireccionamiento autorizados:** (Donde vuelve Google tras aprobar los permisos).
   - En TalentScope, si usamos Supabase para la intermediación, sería la URL de Redirect de tu proyecto de Supabase (las veremos en el siguiente paso), o directamente una ruta en tu app como `https://tu-proyecto.vercel.app/gmail/callback`. (Por ahora añade localhost y tu Vercel base como en el punto 5).
7. Dale a **"Crear"**.
8. Se abrirá un popup con dos datos fundamentales:
   - **ID de cliente** (`Client ID`)
   - **Secreto de cliente** (`Client Secret`)
   > Guárdalos a buen recaudo, los necesitaremos en código o en Supabase.

---

## 🛠️ Conectar Google con Supabase (Recomendado)
Para que toda la gestión de los "Refresh Tokens" sea segura, lo ideal es delegarlo en Supabase Auth, que ya cuenta con integración nativa de Google.

1. Ve el Dashboard de tu [proyecto en Supabase](https://supabase.com).
2. Entra a **"Authentication"** -> **"Providers"**.
3. Busca **"Google"** y actívalo.
4. Pega allí tu **Client ID** y tu **Client Secret** (obtenidos en el Paso 4).
5. Copia la URL que dice `Callback URL (for OAuth)` desde Supabase. _Se parece a `https://[referencia].supabase.co/auth/v1/callback`_.
6. Vuelve a Google Cloud (Paso 4.6) y añade esta URL exacta en **"URI de redireccionamiento autorizados"**. ¡Guarda los cambios!

A partir de este momento, estás listo para escribir el sistema de Login real en la Interfaz de TalentScope utilizando `supabase.auth.signInWithOAuth({ provider: 'google', options: { scopes: 'https://www.googleapis.com/auth/gmail.send' } })`.
