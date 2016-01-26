import logger from './logger';
import token from './token';
import superagent from 'superagent';

let request = {
	get(endpoint, queryData) {
		let req = superagent.get(endpoint);
		if (queryData) {
			req.query(queryData);
		}
		req = addAuthHeader(req);
		return handleResponse(req);
	},
	post(endpoint, data) {
		let req = superagent.post(endpoint).send(data);
		req = addAuthHeader(req);
		return handleResponse(req);
	},
	put(endpoint, data) {
		let req = superagent.put(endpoint, data);
		req = addAuthHeader(req);
		return handleResponse(req);
	},
	del(endpoint, data) {
		let req = superagent.put(endpoint, data);
		req = addAuthHeader(req);
		return handleResponse(req);
	}
};

export default request;

function handleResponse(req) {
	return new Promise((resolve, reject) => {
		if (typeof req.end !== 'function') {
			logger.warn({
				description: 'req.end is not a function', func: 'handleResponse'
			});
			return reject('req.end is not a function');
		}
		req.end((errorRes, res) => {
			if (errorRes) {
				if (errorRes.status == 401) {
					logger.warn({
						description: 'Unauthorized. You must be signed into make this request.',
						func: 'handleResponse'
					});
				}
				const { response } = errorRes;
				const error = (response && response.body) ? response.body.error : errorRes;
				logger.error({
					description: 'Error in request.', error, func: 'handleResponse'
				});
				return reject(error.message || error);
			}
			try {
				resolve(JSON.parse(res.body));
			} catch(err) {
				resolve(res.body);
			}
		});
	});
}
function addAuthHeader(req) {
	if (token.string) {
		req = req.set('Authorization', 'Bearer ' + token.string);
		// logger.info({message: 'Set auth header', func: 'addAuthHeader', file: 'request'});
	}
	return req;
}
