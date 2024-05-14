const express = require("express");
const path = require("path");
const collection = require("./config");
const bcrypt = require('bcrypt');
const axios = require('axios');
const nodemailer = require('nodemailer');

const { EMAIL, PASSWORD } = require('./env.js')

const app = express();

// convert data into json format

app.use(express.json());
// Static file
app.use(express.static("public"));

app.use(express.urlencoded({ extended: false }));
//use EJS as the view engine
app.set("view engine", "ejs");

app.get("/", (req, res) => {
    res.render("login");
});

app.get("/signup", (req, res) => {
    res.render("signup");
});


// Register User
app.post("/signup", async (req, res) => {

    const data = {
        name: req.body.username,
        password: req.body.password,
        email: req.body.email, // Add this line
        location: req.body.location, // Add this line
        // Add more fields as needed
    }


    // Check if the username already exists in the database
    const existingUser = await collection.findOne({ name: data.name });

    if (existingUser) {
        res.send('User already exists. Please choose a different username.');
    } else {
        // Hash the password using bcrypt
        const saltRounds = 10; // Number of salt rounds for bcrypt
        const hashedPassword = await bcrypt.hash(data.password, saltRounds);

        data.password = hashedPassword; // Replace the original password with the hashed one

        const userdata = await collection.insertMany(data);
        console.log(userdata);
    }

});

// Login user 
app.post("/login", async (req, res) => {
    try {
        const check = await collection.findOne({ name: req.body.username });
        if (!check) {
            res.send("User name cannot found")
        }
        // Compare the hashed password from the database with the plaintext password
        const isPasswordMatch = await bcrypt.compare(req.body.password, check.password);
        if (!isPasswordMatch) {
            res.send("wrong Password");
        }
        else {
            res.sendFile(path.join(javascript, 'public', 'index.html'));
        }
    }
    catch {
        res.send("wrong Details");
    }
});



const tempThreshold = { low: 10, high: 35 };
const pressureThreshold = { low: 1000, high: 1015 };
const uvThreshold = { low: 7, high: 10 };
const humidityThreshold = { low: 30, high: 60 };
const airQualityThreshold = 150;

// Configure email transport using Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL,
        pass: PASSWORD
    }
});

app.post('/weather-alert', async (req, res) => {
    try {
        const locations = await collection.distinct('location');
        console.log(locations)

        for (const location of locations) {
            // Fetch weather data from the VisualCrossing API
            const weatherResponse = await axios.get(
                `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${location}?unitGroup=metric&key=EJ6UBL2JEQGYB3AA4ENASN62J&contentType=json`
            );
            const weatherData = weatherResponse.data;

            // Find users for the location
            const users = await collection.find({ location });

            for (const user of users) {
                const {
                    temp,
                    humidity,
                    pressure,
                    uvIndex,
                    airQuality,
                } = weatherData.currentConditions;

                // Check if any threshold is crossed
                if (
                    temp < tempThreshold.low || temp > tempThreshold.high ||
                    pressure < pressureThreshold.low || pressure > pressureThreshold.high ||
                    uvIndex > uvThreshold.high ||
                    humidity < humidityThreshold.low || humidity > humidityThreshold.high ||
                    airQuality > airQualityThreshold
                ) {
                    sendEmailAlert(user.email, user.name, location, weatherData.currentConditions);
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

function sendEmailAlert(recipientEmail, userName, location, weatherData) {
    const {
        temp,
        humidity,
        pressure,
        uvIndex,
        airQuality,
        // Add any other desired properties from the API response
    } = weatherData;

    let message = `Dear ${userName},\n\nGreetings from the Weather Alert System!\n\n`;
    let shouldSendEmail = false;

    // Temperature
    if (temp < tempThreshold.low || temp > tempThreshold.high) {
        message += `Temperature: ${temp}°C (Extreme)\n`;
        shouldSendEmail = true;
    }

    // Pressure
    if (pressure < pressureThreshold.low) {
        message += `Pressure: ${pressure} hPa (Low Pressure (Extreme))\n`;
        shouldSendEmail = true;
    } else if (pressure > pressureThreshold.high) {
        message += `Pressure: ${pressure} hPa (High Pressure (Extreme))\n`;
        shouldSendEmail = true;
    }

    // UV Index
    if (uvIndex > uvThreshold.high) {
        message += `UV Index: ${uvIndex} (Very High (Extreme))\n`;
        shouldSendEmail = true;
    }

    // Humidity
    if (humidity < humidityThreshold.low) {
        message += `Humidity: ${humidity}% (Low (Extreme))\n`;
        shouldSendEmail = true;
    } else if (humidity > humidityThreshold.high) {
        message += `Humidity: ${humidity}% (High (Extreme))\n`;
        shouldSendEmail = true;
    }

    // Air Quality
    if (airQuality > airQualityThreshold) {
        message += `Air Quality Index: ${airQuality} (Unhealthy or Worse (Extreme))😨\n`;
        shouldSendEmail = true;
    }

    if (shouldSendEmail) {
        message += `\nThank you for using our Weather Alert System. Stay safe and have a great day!\n\nBest regards,\nWeather Alert Team`;

        const mailOptions = {
            from: EMAIL,
            to: recipientEmail,
            subject: `Weather Alert for ${location}`,
            text: message,
        };

        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.error(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    }
}

// Define Port for Application
const port = 9999;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
});
