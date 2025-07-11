const { izumi, mode, isAdmin, sleep, parsedJid } = require("../lib/");
const config = require("../config");

const checkPermissions = async (message) => {
    if (message.isSudo) return true;
    if (!config.ADMIN_ACCESS) return false;
    return await message.isAdmin(message.sender);
};
izumi({
    pattern: 'ginfo ?(.*)',
    fromMe: true,
    desc: 'get group info',
    type: 'group',
}, async (message, match, client) => {
let input = match || (message.reply_message && message.reply_message.text) || message.jid;
let metadata;
let id, name, desc;
if (input.includes('chat.whatsapp.com/')) {
    let inviteCode = input.split('chat.whatsapp.com/')[1].trim();
    metadata = await client.groupGetInviteInfo(inviteCode);
    id = metadata.id;
    name = metadata.subject;
    desc = metadata.desc || "No description.";
} else if (input.includes('@g.us')) {
    metadata = await client.groupMetadata(input);
    id = metadata.id;
    name = metadata.subject;
    desc = metadata.desc || "No description.";
} else {
    return await message.reply("Invalid input. Please provide a group JID or invite link.");
}

let caption = `*Name*: ${name}\n*Description*: ${desc}`;
let pfp;

try {
    pfp = await client.profilePictureUrl(id, 'image');
} catch (e) {
    pfp = "https://cdn.eypz.ct.ws/url/15-05-25_06-18_w9fi.png";
}

await client.sendMessage(message.jid, {
    image: { url: pfp },
    mimetype: "image/png",
    caption: caption,
}, { quoted: message.data })
});
izumi({
    pattern: "promote ?(.*)",
    fromMe: false,
    onlyGroup: true,
    desc: "promote to admin",
    type: "group",
},
async (message, match) => {
    if (!(await checkPermissions(message))) return;
    match = match || message.reply_message.sender;
    if (!match) return await message.reply("_Mention user to promote_");

    const isadmin = await message.isAdmin(message.user);
    if (!isadmin) return await message.reply("_I'm not admin_");

    const jid = parsedJid(match);
    await message.promote(jid);

    return await message.send(`_@${jid[0].split("@")[0]} promoted as admin_`, {
        mentions: [jid],
    });
});

izumi(
  {
    pattern: "gpp",
    fromMe: true,
    onlyGroup: true,
    type: "group", 
    desc: "Change group profile picture.",
  },
  async (message) => {
    if (!(await checkPermissions(message))) {
      return await message.reply("You don't have permission to change the group profile picture.");
    }

    if (!message.quoted) {
      return await message.reply("Reply to an image to set it as the group profile picture.");
    }

    try {
      let media = await message.quoted.download();
      await message.client.updateProfilePicture(message.jid, { url: media });
      await message.reply("Group profile picture updated successfully.");
    } catch (error) {
      await message.reply("Failed to update profile picture.");
      console.error(error);
    }
  }
);

izumi({
    pattern: "demote ?(.*)",
    fromMe: false,
    onlyGroup: true,
    desc: "demote from admin",
    type: "group",
},
async (message, match) => {
    if (!(await checkPermissions(message))) return;
    match = match || message.reply_message.sender;
    if (!match) return await message.reply("_Mention user to demote_");

    const isadmin = await message.isAdmin(message.user);
    if (!isadmin) return await message.reply("_I'm not admin_");

    const jid = parsedJid(match);
    await message.demote(jid);

    return await message.send(`_@${jid[0].split("@")[0]} demoted from admin_`, {
        mentions: [jid],
    });
});

izumi({
    pattern: "mute ?(.*)",
    fromMe: false,
    onlyGroup: true,
    desc: "mute group",
    type: "group",
},
async (message, match) => {
    if (!(await checkPermissions(message))) return;
    if (!await isAdmin(message.jid, message.user, message.client))
        return await message.reply("_I'm not admin_");
    await message.reply("_Muting_");
    if (!match || isNaN(match)) {
        await message.mute(message.jid);
        await message.send('*Group Muted.*');
        return;
    }
    await message.mute(message.jid);
    await message.send('_Group muted for ' + match + ' mins_');
    await sleep(1000 * 60 * match);
    await message.unmute(message.jid);
    await message.send('*Group unmuted.*');
});

izumi({
    pattern: "unmute ?(.*)",
    fromMe: false,
    onlyGroup: true,
    desc: "unmute group",
    type: "group",
},
async (message, match) => {
    if (!(await checkPermissions(message))) return;
    if (!await isAdmin(message.jid, message.user, message.client))
        return await message.reply("_I'm not admin_");
    await message.reply("_Unmuting_");
    if (!match || isNaN(match)) {
        await message.unmute(message.jid);
        await message.send('*Group opened.*');
        return;
    }
    await message.unmute(message.jid);
    await message.send('_Group unmuted for ' + match + ' mins_');
    await sleep(1000 * 60 * match);
    await message.mute(message.jid);
    await message.send('*Group closed.*');
});

izumi({
    pattern: "getjids",
    fromMe: false,
    onlyGroup: true,
    desc: "gets jid of all group members",
    type: "group",
},
async (message, match, client) => {
    if (!(await checkPermissions(message))) return;
    let { participants } = await client.groupMetadata(message.jid);
    let participant = participants.map((u) => u.id);
    let str = "╭──〔 *Group Jids* 〕\n";
    participant.forEach((result) => {
        str += `├ *${result}*\n`;
    });
    str += `╰──────────────`;
    message.send(str);
});


izumi({
    pattern: "tag ?(.*)",
    fromMe: false,
    onlyGroup: true,
    desc: "Mention all users in group",
    type: "group",
},
async (message, match) => {
    if (!(await checkPermissions(message))) return;
    
    const { participants } = await message.client.groupMetadata(message.jid);
    let teks = "";
    let mentions = [];

    if (match === "admin" || match === "admins") {
        let admins = participants.filter(v => v.admin !== null).map(v => v.id);
        for (let admin of admins) {
            teks += `彡 @${admin.split('@')[0]}\n`;
        }
        mentions = admins;
        await message.sendMessage(message.jid, teks.trim(), { mentions });
        return;
    } else if (match === "all") {
        for (let mem of participants) {
            teks += `彡 @${mem.id.split("@")[0]}\n`;
        }
        mentions = participants.map(a => a.id);
        await message.sendMessage(message.jid, teks.trim(), { mentions });
        return;
    }

    if (match.trim()) {
        for (let mem of participants) {
            teks += `彡 @${mem.id.split("@")[0]}\n`;
        }
        mentions = participants.map(a => a.id);
        await message.sendMessage(message.jid, `${match.trim()}\n${teks.trim()}`, { mentions });
    }

    if (message.quoted) {
        let jids = participants.map(user => user.id.replace('c.us', 's.whatsapp.net'));
        await message.forwardMessage(message.jid, message.quoted.data, {
            detectLinks: true,
            contextInfo: { mentionedJid: jids }
        });
    }
});
   
izumi({
    pattern: "hidetag ?(.*)",
    fromMe: false,
    onlyGroup: true,
    desc: "send given text with mention",
    type: "group",
},
async (message, match) => {
    if (!(await checkPermissions(message))) return;
    if (!match) {
        return await message.reply("_Eg .hidetag Hello_")
    };
    var group = await message.client.groupMetadata(message.jid);
    var jids = [];
    group.participants.map(user => {
        jids.push(user.id.replace('c.us', 's.whatsapp.net'));
    });
    await message.send(match, {
        mentions: jids
    });
});

izumi({
    pattern: 'invite ?(.*)',
    fromMe: false,
    desc: 'Get Group invite',
    type: 'group',
    onlyGroup: true,
},
async (message, match) => {
    if (!(await checkPermissions(message))) return;
    const participants = await message.groupMetadata(message.jid);
    const isImAdmin = await message.isAdmin(message.user);
    if (!isImAdmin) return await message.reply(`_I'm not admin._`);
    return await message.reply(await message.invite(message.jid));
});

izumi({
    pattern: 'join ?(.*)',
    fromMe: true,
    type: 'group',
    desc: 'Join invite link.',
},
async (message, match) => {
    match = match || message.reply_message.text;
    if (!match)
        return await message.reply(`_Give me a Group invite link._`);
    const wa = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/;
    const [_, code] = match.match(wa) || [];
    if (!code)
        return await message.sendMessage(`_Give me a Group invite link._`);
    await message.accept(code);
    return await message.reply(`_Joined_`);
});

izumi({
    pattern: 'revoke',
    fromMe: false,
    onlyGroup: true,
    type: 'group',
    desc: 'Revoke Group invite link.',
},
async (message, match) => {
    if (!(await checkPermissions(message))) return;
    const isadmin = await message.isAdmin(message.user);
    if (!isadmin) return await message.reply(`_I'm not admin._`);
    await message.revoke(message.jid);
});

izumi({
    pattern: 'left ?(.*)',
    fromMe: true,
    desc: 'To leave from group',
    type: 'user',
    onlyGroup: true,
},
async (message, match) => {
    if (match) await message.send(match);
    return await message.left(message.jid);
});

izumi({
    pattern: "mee",
    fromMe: mode,
    onlyGroup: false,
    desc: "self tag",
    type: "group",
},
async (message, match) => {
    const {
        participants
    } = await message.groupMetadata(message.jid);
    const senderId = message.sender.split('@')[0];
    let teks = `@${senderId}\n`;
    await message.sendMessage(message.jid, teks.trim(), {
        mentions: [message.sender]
    });
});

izumi({
    pattern: 'del',
    fromMe: false,
    onlyGroup: true,
    type: 'group',
    desc: 'Delete message sent by a participant.',
},
async (message, match) => {
    if (!(await checkPermissions(message))) return;
    if (!message.reply_message) return await message.reply('_Reply to a message_');
    const isadmin = await message.isAdmin(message.user);
    if (!isadmin) return await message.reply(`_I'm not admin._`);
    await message.client.sendMessage(message.chat, {
        delete: {
            remoteJid: message.chat,
            fromMe: message.quoted.fromMe,
            id: message.quoted.id,
            participant: message.quoted.sender
        }
    });
});

izumi({
    pattern: "add ?(.*)",
    fromMe: false,
    desc: "Add a person to the group",
    type: "group",
},
async (message, match) => {
    if (!(await checkPermissions(message))) return;
    if (!message.isGroup) {
        return await message.reply("*_This command only works in group chats_*");
    }

    let num;

    if (message.quoted) {
        num = message.quoted.sender;
    } else {
        num = match;
    }

    if (!num) {
        return await message.reply("*_Need a number/reply to a message!_*");
    }

    let user = num.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    let admin = await isAdmin(message.jid, message.user, message.client);

    if (!admin) {
        return await message.reply("*_I'm not admin_*");
    }

    try {
        await message.client.groupParticipantsUpdate(message.jid, [user], "add");
        return await message.client.sendMessage(message.jid, {
            text: `*_@${user.split("@")[0]}, Added to the Group!_*`,
            mentions: [user],
        });
    } catch (error) {
        return await message.reply("*_Failed to add the person to the group. Please check the number and try again._*");
    }
});

izumi({
    pattern: "kick ?(.*)",
    fromMe: false,
    desc: "Kick a person from the group",
    type: "group",
},
async (message, match) => {
    if (!(await checkPermissions(message))) return;
    if (!message.isGroup) {
        return await message.reply("*_This command only works in group chats_*");
    }

    let num = match || (message.quoted ? message.quoted.sender : null);

    if (!num) {
        return await message.reply("*_Need a number/reply/mention!_*");
    }

    num = num.replace(/[^0-9]/g, "") + "@s.whatsapp.net"; // Ensure num is in the correct format

    let admin = await isAdmin(message.jid, message.user, message.client);

    if (!admin) {
        return await message.reply("*_I'm not admin_*");
    }

    try {
        await message.client.groupParticipantsUpdate(message.jid, [num], "remove");
        let userMention = `@${num.split("@")[0]}`;
        return await message.client.sendMessage(message.jid, {
            text: `*_ ${userMention}, Kicked from The Group!_*`,
            mentions: [num],
        });
    } catch (error) {
        console.error("Error kicking user:", error);
        return await message.reply("*_Failed to kick the user_*");
    }
});

izumi({
    pattern: 'whois ?(.*)',
    fromMe: true,
    desc: 'fetch user info',
    type: 'user',
}, async (message, match, client) => {
let number = match || (message.reply_message && message.reply_message.jid);
if (!number) return await message.reply("Please provide or reply to a number.");

if (!number.includes('@s.whatsapp.net')) {
    number = number.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
}
try {
    about = (await client.fetchStatus(number))?.status || "No about/status found.";
} catch {
    about = "Privacy settings hide about.";
}

let pfp;
try {
    pfp = await client.profilePictureUrl(number, 'image');
} catch {
    pfp = "https://cdn.eypz.ct.ws/url/31-05-25_00-40_9e70.png";
}

let lastSeen = "Unavailable or hidden";
try {
    const presence = await client.presenceSubscribe(number);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const last = client.chatUpdate?.[number]?.lastSeen;
    if (last) {
        lastSeen = new Date(last * 1000).toLocaleString();
    }
} catch {
    lastSeen = "Private or not available";
}

let caption = `*About:* ${about}\n*Last Seen:* ${lastSeen}`;
await client.sendMessage(message.jid, {
    image: { url: pfp },
    mimetype: "image/png",
    caption: caption
}, { quoted: message.data });
});

izumi({
  pattern: 'gjid$',
  fromMe: true,
  desc: 'Shows all group names, JIDs, and member counts',
  type: 'group'
}, async (message, match, client) => {
  const groups = await client.groupFetchAllParticipating();
  let text = '*Group Info*\n\n';

  for (const jid in groups) {
    const group = groups[jid];
    const groupName = group.subject || 'Unknown';
    const memberCount = group.participants?.length || group.size || 0;

    text += `*Name:* ${groupName}\n*JID:* ${jid}\n*Members:* ${memberCount}\n\n`;
  }

  await message.reply(text.trim());
});
