const { MongoClient } = require("mongodb");

// Netlify ki tijori se automatic chabi kheench lega
const uri = process.env.MONGODB_URI; 
const client = new MongoClient(uri);

exports.handler = async (event, context) => {
    try {
        await client.connect();
        const database = client.db("SapnaJuiceDB"); // Aapke DB ka naam
        const collection = database.collection("menu"); // Khate ka naam

        // MongoDB se saara menu utha lo
        const menuData = await collection.find({}).toArray();

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // Har screen ko allow karo
                "Content-Type": "application/json"
            },
            body: JSON.stringify(menuData)
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    } finally {
        await client.close();
    }
};