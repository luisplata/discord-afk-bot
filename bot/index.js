require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require('discord.js');
const databaseFacade = require('./src/database/database_facade');
const moment = require('moment');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ],
});

// Helper function to handle guild saving and updating
const saveGuildInfo = async (guildData) => {
    const existingGuild = await databaseFacade.get('guilds', guildData.id);
    if (existingGuild) {
        await databaseFacade.update('guilds', guildData.id, guildData);
        console.log(`Updated guild: ${guildData.name} (ID: ${guildData.id})`);
    } else {
        await databaseFacade.save('guilds', guildData.id, guildData);
        console.log(`Saved guild: ${guildData.name} (ID: ${guildData.id})`);
    }
};

// Helper function to normalize channel name
const normalizeChannelName = (name) => {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');
};

// Helper function to split large lists into chunks
const splitIntoChunks = (array, size) => {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size).join('\n'));
    }
    return result;
};

// Initialize the bot when ready
client.once('ready', async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log('Servers:');

    client.guilds.cache.forEach(async guild => {
        const returnData = await checkServers(guild, "AFK", "Bellgilante", "Bellgilante-log");
        console.log(`✅ Server: ${guild.name} (ID: ${guild.id}) - Role: ${returnData.Rol.name} - Category: ${returnData.Category.name} - Channel: ${returnData.Channel.name}`);

        returnData.members = await getGuildMembersInfo(guild);
        returnData.name = guild.name;
        returnData.id = guild.id;

        await applyCategoryPermissions(guild, returnData.Rol.id, returnData.Category.id);
        saveGuildInfo(returnData);
    });

    // Schedule inactivity check every 24 hours
    setInterval(async () => {
        client.guilds.cache.forEach(async guild => {
            console.log(`🔄 Checking inactive users in server: ${guild.name}`);
            let dataFromDB = await getGuildInfo(guild);
            await checkInactiveUsers(guild, 30, 37, 44, 50, dataFromDB.Rol.id, dataFromDB.Channel.id);
        });
    },
        1000 * 60 * 60 * 24 // Check every 24 hours (adjust as necessary)
    ); // Check every second (adjust as necessary)
});

// Command handling for AFK list
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'afklist') {
        const guildId = interaction.guild.id;
        const guildData = await databaseFacade.get('guilds', guildId);

        if (!guildData || !guildData.members) {
            await interaction.reply('No data found for this server.');
            return;
        }

        const now = new Date();
        const afkList = guildData.members.map(member => {
            if (!member.lastMessageAt) return `🕳️ ${member.tag} — Never sent a message`;

            const last = new Date(member.lastMessageAt);
            const diffMs = now - last;
            const mins = Math.floor(diffMs / 60000) % 60;
            const hours = Math.floor(diffMs / 3600000) % 24;
            const days = Math.floor(diffMs / 86400000);

            return `🧍 ${member.tag} — ${days}d ${hours}h ${mins}m AFK`;
        });

        const chunks = splitIntoChunks(afkList, 15);
        for (const chunk of chunks) {
            await interaction.reply({ content: chunk, ephemeral: false });
        }
    }
});

// Update last message time when a message is sent
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const { author, guild } = message;
    const guildId = guild.id;
    const userId = author.id;

    const guildData = await databaseFacade.get('guilds', guildId);
    if (!guildData) return;

    const members = guildData.members || [];
    const memberIndex = members.findIndex(m => m.id === userId);

    if (memberIndex !== -1) {
        members[memberIndex].lastMessageAt = new Date().toISOString();
        await databaseFacade.update('guilds', guildId, { members });
        console.log(`🕒 Last activity updated for ${members[memberIndex].tag} in ${guild.name}`);
    } else {
        console.warn(`⚠️ User ${author.tag} not found in the guild ${guild.name}`);
    }
});

// Add new member to the guild
client.on('guildMemberAdd', async (member) => {
    const guildId = member.guild.id;
    const guildData = await databaseFacade.get('guilds', guildId);
    if (!guildData) return;

    const newMember = {
        tag: member.user.tag,
        id: member.id,
        joinedAt: member.joinedAt?.toISOString() || new Date().toISOString(),
        lastMessageAt: null,
        roles: member.roles.cache
            .filter(role => role.name !== '@everyone')
            .map(role => ({ id: role.id, name: role.name })),
        isOwner: member.id === member.guild.ownerId
    };

    guildData.members.push(newMember);
    await databaseFacade.update('guilds', guildId, { members: guildData.members });

    console.log(`✅ New member added: ${newMember.tag} to ${member.guild.name}`);
});

// Remove member from the guild
client.on('guildMemberRemove', async (member) => {
    const guildId = member.guild.id;
    const guildData = await databaseFacade.get('guilds', guildId);
    if (!guildData) return;

    const updatedMembers = guildData.members.filter(m => m.id !== member.id);
    await databaseFacade.update('guilds', guildId, { members: updatedMembers });

    console.log(`❌ Member removed: ${member.user.tag} from ${member.guild.name}`);
});

client.on('guildCreate', async (guild) => {
    console.log(`📥 Bot added to new server: ${guild.name} (ID: ${guild.id})`);

    // Realiza la configuración inicial exactamente igual que en el "ready"
    const returnData = await checkServers(guild, "AFK", "Bellgilante", "Bellgilante-log");
    console.log(`✅ Server initialized: ${guild.name} - Role: ${returnData.Rol.name} - Category: ${returnData.Category.name} - Channel: ${returnData.Channel.name}`);

    returnData.members = await getGuildMembersInfo(guild);
    returnData.name = guild.name;
    returnData.id = guild.id;

    await applyCategoryPermissions(guild, returnData.Rol.id, returnData.Category.id);
    await saveGuildInfo(returnData);
});


// Function to retrieve the AFK time of a user
function getAfkTime(lastMessageAt) {
    if (!lastMessageAt) return null;

    const now = new Date();
    const lastActive = new Date(lastMessageAt);
    const diffMs = now - lastActive;

    const minutes = Math.floor(diffMs / 60000) % 60;
    const hours = Math.floor(diffMs / 3600000) % 24;
    const days = Math.floor(diffMs / 86400000);

    return { days, hours, minutes };
}

// Fetch members info for a guild
async function getGuildMembersInfo(guild) {
    await guild.members.fetch();

    const previousData = await databaseFacade.get('guilds', guild.id);
    const previousMembers = previousData?.members || [];

    const membersInfo = [];
    guild.members.cache.forEach(member => {
        const previousMember = previousMembers.find(m => m.id === member.id);

        const lastMessageAt = member.lastMessage?.createdAt || previousMember?.lastMessageAt || null;

        membersInfo.push({
            tag: member.user.tag,
            id: member.id,
            joinedAt: member.joinedAt,
            lastMessageAt,
            roles: member.roles.cache
                .filter(role => role.name !== '@everyone')
                .map(role => ({ id: role.id, name: role.name })),
            isOwner: member.id === guild.ownerId
        });
    });

    return membersInfo;
}

async function getGuildInfo(guild) {
    const previousData = await databaseFacade.get('guilds', guild.id);

    if (!previousData) {
        return {
            Rol: null,
            Category: null,
            Channel: null
        };
    }

    return {
        Rol: previousData.Rol || null,
        Category: previousData.Category || null,
        Channel: previousData.Channel || null
    };
}


// Function to handle server setup (roles, category, and channels)
async function checkServers(guild, rolName, categoryName, rawChannelName) {
    const channelName = normalizeChannelName(rawChannelName);

    const dataToReturn = {
        Rol: {},
        Category: {},
        Channel: {}
    };

    let modRole = guild.roles.cache.find(role => role.name === rolName);
    if (!modRole) {
        modRole = await guild.roles.create({
            name: rolName,
            color: 'Blue',
            reason: 'Role needed for the AFK bot',
        });
        console.log(`✅ Role "${rolName}" created.`);
    }
    dataToReturn.Rol.name = modRole.name;
    dataToReturn.Rol.id = modRole.id;

    let category = guild.channels.cache.find(
        c => c.name === categoryName && c.type === ChannelType.GuildCategory
    );
    if (!category) {
        category = await guild.channels.create({
            name: categoryName,
            type: ChannelType.GuildCategory,
        });
        console.log(`📁 Category "${categoryName}" created.`);
    }
    dataToReturn.Category.name = category.name;
    dataToReturn.Category.id = category.id;

    await guild.channels.fetch();

    let channel = guild.channels.cache.find(
        c => c.name === channelName && c.type === ChannelType.GuildText
    );

    if (channel && channel.parentId !== category.id) {
        await channel.setParent(category.id);
        console.log(`🔀 Channel "${channelName}" moved to the correct category.`);
    }

    if (!channel) {
        channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: modRole.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                    ],
                },
            ],
        });
        console.log(`📺 Channel "${channelName}" created in the category.`);
    }

    dataToReturn.Channel.name = channel.name;
    dataToReturn.Channel.id = channel.id;

    return dataToReturn;
}

// Function to apply permissions to the category
async function applyCategoryPermissions(guild, roleId, categoryId) {
    const categoryChannel = guild.channels.cache.get(categoryId);
    if (!categoryChannel) {
        console.warn(`❌ No category found with ID: ${categoryId}`);
        return;
    }

    await categoryChannel.permissionOverwrites.set([
        {
            id: guild.roles.everyone.id,
            deny: ['ViewChannel'],
        },
        {
            id: roleId,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
        },
    ]);

    console.log(`🔒 Permissions applied to category "${categoryChannel.name}" for role with ID ${roleId}`);
}

// Function to check inactive users based on AFK rules
async function checkInactiveUsers(guild, first_line, second_line, third_line, last_line, rol_id, chanel_log) {
    const members = await getGuildMembersInfo(guild);

    for (const user of members) {
        const member = await guild.members.fetch(user.id);
        const diffInDays = moment().diff(moment(user.lastMessageAt), 'days');
        console.log(`Checking AFK status for ${user.tag} - AFK days: ${diffInDays}`);

        if (diffInDays >= first_line && diffInDays < second_line) {
            const afkRole = await guild.roles.fetch(rol_id);
            if (afkRole) {
                member.roles.remove(member.roles.cache.map(role => role.id));
                member.roles.add(afkRole);
            }

            const logsChannel = guild.channels.cache.get(chanel_log);
            if (logsChannel) {
                logsChannel.send({
                    content: `🚨 *Warning* 🚨: ${user.tag}, you have been AFK for over ${first_line} days. Moved to AFK role.`,
                    ephemeral: true,
                });
            }
        }

        if (diffInDays >= second_line && diffInDays < third_line) {
            const logsChannel = guild.channels.cache.get(chanel_log);
            if (logsChannel) {
                logsChannel.send({
                    content: `⚠️ Second warning: ${user.tag}, you have been AFK for more than ${second_line} days. Make activity or you'll be kicked.`,
                    ephemeral: true,
                });
            }
        }

        if (diffInDays >= third_line && diffInDays < last_line) {
            const logsChannel = guild.channels.cache.get(chanel_log);
            if (logsChannel) {
                logsChannel.send({
                    content: `⚠️ Last warning: ${user.tag}, you have been AFK for over ${third_line} days. Final warning before kick.`,
                    ephemeral: true,
                });
            }
        }

        if (diffInDays >= last_line && !user.isOwner) {
            try {
                //await member.kick('Expulsado por inactividad prolongada');
                const logsChannel = guild.channels.cache.get(chanel_log);
                if (logsChannel) {
                    logsChannel.send({
                        content: `❌ *Expulsado* ❌: ${user.tag} ha sido expulsado por estar AFK durante más de ${last_line} días.`,
                        ephemeral: true,
                    });
                }
            } catch (error) {
                console.error(`No se pudo expulsar a ${user.tag}:`, error);
            }
        }
    }
}

client.login(process.env.BOT_TOKEN);