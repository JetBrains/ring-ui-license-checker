export default function format(params) {
  return `<chapter title="${params.title}" id="${params.title.replace(/\s+/g, '_')}">
  <table>
    <tr>
      <td>Project</td>
      <td>Version</td>
      <td>License</td>
    </tr>${params.modules
      .map(
        module =>
          `
    <tr>
      <td><a href="${module.url}">${module.name}</a></td>
      <td>${module.version}</td>
      <td><a href="${module.license.url}">${module.license.name}</a></td>
    </tr>`,
      )
      .join('')}
  </table>
</chapter>`
}
