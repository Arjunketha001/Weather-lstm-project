import * as tf from '@tensorflow/tfjs';

// Get the location from the user input
const locationInput = document.getElementById('locationInput');
const apiKey = 'LFDCAVPQHQLSPZ2M8KNG5PHJW'; // Replace with your actual API key

// Add an event listener to the input field
locationInput.addEventListener('input', async () => {
  const location = locationInput.value.trim();

  if (location) {
    // Fetch temperature data from the Visual Crossing API
    const temperatureData = await fetchTemperatureData(apiKey, location);
    const preprocessedData = preprocessData(temperatureData);

    // Prepare the data for LSTM input
    const windowSize = 6; // 6 hours
    const [X, y] = createSequences(preprocessedData, windowSize);

    // Build the LSTM model
    const model = tf.sequential();
    model.add(tf.layers.lstm({ units: 32, inputShape: [windowSize, 1], returnSequences: true }));
    model.add(tf.layers.lstm({ units: 16, returnSequences: true }));
    model.add(tf.layers.lstm({ units: 8 }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1 }));

    // Compile the model
    const optimizer = tf.train.adam();
    model.compile({ optimizer, loss: 'meanSquaredError' });

    // Train the model
    const batchSize = 32;
    const epochs = 50;
    const ValData = 0.2; // 20% of the data for validation

    const [trainX, trainY, valX, valY] = tf.data.trainTestSplit(tf.concat([X, y], 1), ValData);
    const trainData = tf.data.array(trainX, trainY, batchSize);
    const valData = tf.data.array(valX, valY, batchSize);

    await model.fit(trainData, { epochs, validationData: valData });

    // Make predictions
    const futureWindow = X.slice(-windowSize);
    const futureTemperatures = [];

    for (let i = 0; i < 24; i++) { // Predict for the next 24 hours
      const prediction = model.predict(tf.tensor2d([futureWindow])).dataSync()[0];
      futureTemperatures.push(prediction);
      futureWindow.shift();
      futureWindow.push(prediction);
    }

    console.log("Predicted temperatures for the next 24 hours:");
    console.log(futureTemperatures);
  }
});

// Function to fetch temperature data from the Visual Crossing API
async function fetchTemperatureData(apiKey, location) {
  const apiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${location}?unitGroup=metric&key=${apiKey}&contentType=json`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    const temperatureData = data.days.map(day => day.temp);
    return temperatureData;
  } catch (error) {
    console.error('Error fetching temperature data:', error);
    return [];
  }
}


let currentCity = "";
let currentUnit = "c";
let hourlyorWeek = "week";

// function to get date and time
function getDateTime() {
  let now = new Date(),
    hour = now.getHours(),
    minute = now.getMinutes();

  let days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  // 12 hours format
  hour = hour % 12;
  if (hour < 10) {
    hour = "0" + hour;
  }
  if (minute < 10) {
    minute = "0" + minute;
  }
  let dayString = days[now.getDay()];
  return `${dayString}, ${hour}:${minute}`;
}

