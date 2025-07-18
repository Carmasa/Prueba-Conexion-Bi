const usuarios = [
  { username: 'Ares' , password: '1234', clinica: 'Ares', sistema: 'gesden' },
  { username: 'Murua',  password: '5678', clinica: 'Murua', sistema: 'klinikale' },
  { username: 'Almidental', password: '91011', clinica: 'Almidental', sistema: 'odontonet' },
  { username: 'Amelar', password: '1213', clinica: 'Amelar', sistema: 'odontonet' },
];

document.getElementById('loginButton').addEventListener('click', function () {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const error = document.getElementById('error');

  // Buscar usuario por nombre
  const user = usuarios.find(u => u.username === username);

  if (!user) {
    error.textContent = "Usuario no encontrado.";
    return;
  }
  if (user.password !== password) {
    error.textContent = "Contraseña incorrecta.";
    return;
  }

  // Guardar sistema asociado a esa clínica
  localStorage.setItem('usuario', user.clinica);
  localStorage.setItem('gestor', user.sistema);

  window.location.href = "ingresos.html";
});