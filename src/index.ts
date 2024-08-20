import { AxiosClone } from './axiosClone';

const axios = new AxiosClone({ retries: 3, delay: 1000 });

axios.get('https://nekonode.net/api/latest', {
  headers: { 'Content-Type': 'application/json' },
  params: {
    page: 1,
    type: 2,
    limit: 10,
  },
})
  .then(response => {
    console.log('Response Data:', response);
  })
  .catch(error => console.error('Request failed:', error));
