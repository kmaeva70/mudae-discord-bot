import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import axios from 'axios';
import mongoose from 'mongoose';

dotenv.config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to MongoDB!"))
    .catch(err => console.error("MongoDB connection error:", err));

const UserSchema = new mongoose.Schema({
    discordId: String,
    shipLists: [{ name: String, ships: mongoose.Schema.Types.Mixed }],
});
const User = mongoose.model('User', UserSchema);

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (message.content.startsWith('$mm') || message.content.startsWith('$mymarry')) {
        await message.channel.send('Processing your Mudae list...');
        const characters = extractCharacters(message.content);
        const ships = await fetchShipsFromAPI(characters);
        
        if (ships.length > 0) {
            await message.channel.send(`Here are your ships:\n${ships.join('\n')}`);
            await syncWithDatabase(message.author.id, characters, ships);
        } else {
            await message.channel.send('No ships found.');
        }
    }
    
    if (message.content.startsWith('!ship')) {
        const character = message.content.split(' ')[1];
        if (!character) {
            return message.channel.send('Please provide a character name.');
        }
        
        try {
            const response = await axios.get(`http://localhost:5000/ships/${character}`);
            const ships = response.data;
            
            if (Object.keys(ships).length > 0) {
                await message.channel.send(`Ships for **${character}**:\n${JSON.stringify(ships, null, 2)}`);
            } else {
                await message.channel.send(`No ships found for **${character}**.`);
            }
        } catch (error) {
            console.error(`Error fetching ships for ${character}:`, error);
            await message.channel.send('Error retrieving ship data. Please try again later.');
        }
    }
    
    if (message.content.startsWith('!mudae')) {
        await message.channel.send('Generating your Mudae ship command...');
        try {
            const response = await axios.get("http://localhost:5000/mudae-command", {
                headers: { Authorization: process.env.BOT_AUTH_TOKEN }
            });
            await message.channel.send(`Your Mudae ship command:\n\`${response.data.mudaeCommand}\``);
        } catch (error) {
            console.error("Error generating Mudae command:", error);
            await message.channel.send('Error generating Mudae command. Try again later.');
        }
    }
});

const extractCharacters = (text) => {
    return text.split('\n').slice(1).map(line => line.trim());
};

const fetchShipsFromAPI = async (characters) => {
    const shipResults = [];
    for (const char of characters) {
        try {
            const response = await axios.get(`http://localhost:5000/ships/${char}`);
            shipResults.push(`${char}: ${JSON.stringify(response.data)}`);
        } catch (error) {
            console.error(`Error fetching ships for ${char}:`, error);
        }
    }
    return shipResults;
};

const syncWithDatabase = async (discordId, characters, ships) => {
    try {
        let user = await User.findOne({ discordId });
        if (!user) {
            user = new User({ discordId, shipLists: [] });
        }
        user.shipLists.push({ name: 'Mudae Sync', ships });
        await user.save();
        console.log(`Synced Mudae list for user ${discordId}`);
    } catch (error) {
        console.error("Error syncing with database:", error);
    }
};

client.login(process.env.DISCORD_BOT_TOKEN);


