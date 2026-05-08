# Guía de Contribución - Alentapp

¡Gracias por querer contribuir a Alentapp! Para mantener el código limpio y organizado, seguimos estas reglas de contribución.

## 🌿 Estrategia de Ramas (Branching)

No se permite pushear directamente a la rama `main`. Todas las contribuciones deben hacerse a través de **Feature Branches**.

### Formato de nombres de rama:

- `feature/nombre-de-la-funcionalidad` (para nuevas características)
- `fix/descripcion-del-error` (para corrección de bugs)
- `docs/mejoras-en-documentacion` (para cambios en docs)
- `refactor/nombre-del-cambio` (para mejoras de código sin cambio de lógica)

---

## 🛠 Flujo de Trabajo (Workflow)

1.  **Sincronizar**: Asegúrate de tener la última versión de `main`:
    ```bash
    git checkout main
    git pull origin main
    ```
2.  **Crear Rama**: Crea tu rama de trabajo:
    ```bash
    git checkout -b feature/nueva-funcionalidad
    ```
3.  **Desarrollar**: Escribe tu código siguiendo los estándares del proyecto.
4.  **Verificar**: Antes de subir tus cambios, **todos los tests deben pasar**. Consulta la [Guía de Testing](./TESTING.md) para más detalles.
    - `npm run test` (Unitarios)
5.  **Commit**: Realiza commits descriptivos siguiendo el formato definido en la sección [Convención de Commits](#-convención-de-commits).
6.  **Pull Request (PR)**: Sube tu rama y abre un PR hacia `main`. Describe claramente qué cambios introdujiste.

---

## 🧾 Convención de Commits

Todos los commits deben seguir el formato:

```bash
tipo(scope): descripcion
```

El repositorio incluye un hook `commit-msg` para validar automáticamente el formato de los mensajes de commit.

Para activarlo localmente, ejecutar una única vez desde la raíz del repositorio:

```bash
git config core.hooksPath .githooks
```

## 🎨 Estándares de Código

- **Linting**: Asegúrate de correr `npm run lint` antes de commitear.
- **Tipado**: No uses `any` en TypeScript. Define interfaces o tipos para todo.
- **Documentación**: Si agregas una funcionalidad compleja, actualiza los docs correspondientes.

---

## ✅ Checklist para Pull Requests

- [ ] ¿Pasan todos los tests locales?
- [ ] ¿La rama tiene un nombre descriptivo?
- [ ] ¿Se eliminaron `console.log` o comentarios innecesarios?
- [ ] ¿Se actualizó la documentación si era necesario?
