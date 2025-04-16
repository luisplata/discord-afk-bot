const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('afklist')
    .setDescription('Muestra el tiempo AFK de todos los miembros del servidor')
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🔄 Registrando comandos...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('✅ Comando /afklist registrado correctamente.');
  } catch (error) {
    console.error('❌ Error al registrar comando:', error);
  }
})();
