const axios = require('axios');

axios.post('http://localhost:9999/weather-alert')
    .then(response => {
        console.log('Weather alert triggered successfully');
    })
    .catch(error => {
        console.error('Error triggering weather alert:', error);
    });
