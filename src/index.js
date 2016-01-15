import config from './config';
import logger from './utils/logger';
import * as dom from './utils/dom';
import request from './utils/request';
import token from './utils/token';
import envStorage from './utils/envStorage';
import ProviderAuth from './utils/providerAuth';
import {
	isString, isArray,
	isObject, has,
	any, every
} from 'lodash';
export default class Matter {
	/** Constructor
	 * @param {String} appName Name of application
	 */
	constructor(appName, opts) {
		if (!appName) {
			logger.error({
				description: 'Application name required to use Matter.',
				func: 'constructor', obj: 'Matter'
			});
			throw new Error('Application name is required to use Matter');
		} else {
			this.name = appName;
		}
		if (opts) {
			this.options = opts;
			if(this.options.logLevel){
				config.logLevel = this.options.logLevel;
			}
		}
		this.config = config;
		logger.debug({
			description: 'Matter object built.', matter: this,
			func: 'constructor', obj: 'Matter'
		});
	}
	/** Get current logged in status
	 * @return {Boolean}
	 * @example
	 * //Check if there is an account currently logged in
	 * if(matter.isLoggedIn){
	 *   console.log('There is currently an account logged in.');
	 * } else {
	 *   console.warn('There is no account currently logged in.');
	 * }
	 */
	get isLoggedIn() {
		return this.token.string ? true : false;
	}
	/** Endpoint generation that handles default/provided settings and environment
	 * @return {String} endpoint - endpoint for tessellate application
	 */
	get endpoint() {
		//Handle options
		if (has(this, 'options')) {
			if (this.options.localServer) {
				config.envName = 'local';
				logger.log({
					description: 'LocalServer option was set to true. Now server url is local server.',
					url: config.serverUrl, func: 'endpoint', obj: 'Matter'
				});
			}
			if (this.options.env) {
				config.envName = this.options.env;
				logger.log({
					description: 'Environment set based on provided environment.',
					config: config, func: 'endpoint', obj: 'Matter'
				});
			}
		}
		let appEndpoint = `${config.serverUrl}/apps/${this.name}`;
		//Handle tessellate as name
		if (this.name == 'tessellate') {
			//Remove url if host is a tessellate server
			if (typeof window !== 'undefined' && has(window, 'location') && window.location.host.indexOf('tessellate') !== -1) {
				appEndpoint = '';
				logger.info({
					description: 'Host is Tessellate Server, serverUrl simplified!',
					url: appEndpoint, func: 'endpoint', obj: 'Matter'
				});
			} else {
				appEndpoint = config.serverUrl;
				logger.info({
					description: 'App is tessellate, serverUrl set as main tessellate server.',
					url: appEndpoint, func: 'endpoint', obj: 'Matter'
				});
			}
		}
		logger.log({
			description: 'Endpoint created.', url: appEndpoint,
			func: 'endpoint', obj: 'Matter'
		});
		return appEndpoint;
	}
	get urls() {
		if(this.token && this.token.data && this.token.data.username){
			return {
				update: `${this.endpoint}/account/${this.token.data.username}`,
				upload: `${this.endpoint}/account/${this.token.data.username}/upload`,
				recover: `${this.endpoint}/recover`
			}
		}
		return {
			recover: `${this.endpoint}/recover`
		}
	}
	/** Signup a new user
	 * @param {Object} signupData - Object containing data to use while signing up to application.
	 * @param {String} signupData.username - Username of new user (error will be returned if username is taken)
	 * @param {String} signupData.email - Email of new user (error will be returned if email is already used)
	 * @param {String} signupData.password - Password to be used with account (will be encrypted).
	 * @return {Promise}
	 * @example
	 * //Signup a new user
	 * var signupData = {username: 'testuser1', email:'test@email.com', password: 'testpassword'};
	 * matter.signup(signupData).then(function(signupRes){
	 *  console.log('New user signed up successfully. New account: ', signupRes.account);
	 * }, function(err){
	 *  console.error('Error signing up:', err);
	 * });
	 */
	signup(signupData) {
		logger.debug({
			description: 'Signup called.', signupData: signupData,
			func: 'signup', obj: 'Matter'
		});
		if (!signupData || (!isObject(signupData) && !isString(signupData))) {
			logger.error({
				description: 'Signup information is required to signup.',
				func: 'signup', obj: 'Matter'
			});
			return Promise.reject({
				message: 'Signup data is required to signup.',
				status: 'NULL_DATA'
			});
		}
		if (isObject(signupData)) {
			//Handle no username or email
			if (!signupData.username && !signupData.email) {
				logger.error({
					description: 'Email or Username required to signup.',
					func: 'signup', obj: 'Matter'
				});
				return Promise.reject({
					message: 'Email or Username required to signup.',
					status: 'ID_REQUIRED'
				});
			}
			if (!signupData.password) {
				logger.error({
					description: 'Password is required to signup.',
					func: 'signup', obj: 'Matter'
				});
				return Promise.reject({
					message: 'Password is required to signup.',
					status: 'PASS_REQUIRED'
				});
			}
			return request.post(this.endpoint + '/signup', signupData)
			.then((response) => {
				logger.info({
					description: 'Signup successful.',
					signupData: signupData, response: response,
					func: 'signup', obj: 'Matter'
				});
				if (has(response, 'account')) {
					return response.account;
				} else {
					logger.warn({
						description: 'Account was not contained in signup response.',
						signupData: signupData, response: response,
						func: 'signup', obj: 'Matter'
					});
					return response;
				}
			})
			['catch']((errRes) => {
				logger.error({
					description: 'Error requesting signup.',
					signupData: signupData,
					func: 'signup', obj: 'Matter'
				});
				return Promise.reject(errRes);
			});
		} else {
			//Handle 3rd Party signups
			logger.debug({
				description: 'Third party signup called.',
				provider: signupData, func: 'signup', obj: 'Matter'
			});
			let auth = new ProviderAuth({provider: signupData, app: this});
			return auth.signup(signupData).then((res) => {
				logger.info({
					description: 'Provider signup successful.',
					provider: signupData, res: res,
					func: 'signup', obj: 'Matter'
				});
				return res;
			}, error => {
				logger.error({
					description: 'Provider signup successful.',
					provider: signupData, error,
					func: 'signup', obj: 'Matter'
				});
				return Promise.reject(error);
			});
		}
	}
	/** Login by username/email or external provider
	 * @param {Object} loginData - Object containing data to use while logging in to application.
	 * @param {String} loginData.username - Username of user to login as
	 * @param {String} loginData.email - Email of new user (Optional instead of username)
	 * @param {String} loginData.password - Password to be used with account (will be encrypted).
	 * @return {Promise}
	 * @example
	 * //Login as 'testuser1'
	 * var loginData = {username: 'testuser1', password: 'testpassword'};
	 * matter.login(loginData).then(function(loginRes){
	 *  console.log('New user logged in succesfully. Account: ', loginRes.account);
	 * }, function(err){
	 *  console.error('Error logging in:', err);
	 * });
	 */
	login(loginData) {
		if (!loginData || (!isObject(loginData) && !isString(loginData))) {
			logger.error({
				description: 'Username/Email and Password are required to login',
				func: 'login', obj: 'Matter'
			});
			return Promise.reject({
				message: 'Login data is required to login.',
				status: 'DATA_REQUIRED'
			});
		}
		if (isObject(loginData)) {
			//Handle no username or email
			if (!loginData.username && !loginData.email) {
				logger.error({
					description: 'Email or Username required to login.',
					func: 'login', obj: 'Matter'
				});
				return Promise.reject({
					message: 'Email or Username required to login.',
					status: 'ID_REQUIRED'
				});
			}
			//Handle null or invalid password
			if (!loginData.password || loginData.password === '') {
				return Promise.reject({
					message: 'Password is required to login.',
					status: 'PASS_REQUIRED'
				});
			}
			//Username/Email Login
			return request.put(this.endpoint + '/login', loginData)
			.then((response) => {
				if (has(response, 'data') && has(response.data, 'status') && response.data.status == 409) {
					logger.error({
						description: 'Account not found.',response: response,
						func: 'login', obj: 'Matter'
					});
					return Promise.reject(response.data);
				} else {
					logger.info({
						description: 'Successful login.', response: response,
						func: 'login', obj: 'Matter'
					});
					if (has(response, 'token')) {
						this.token.string = response.token;
					}
					let userAccount = {};
					//Get user data either directly from response or from token
					if (has(response, 'account')) {
						userAccount = response.account;
					} else if (this.token.data) {
						//TODO: Handle more Auth Provider tokens
						//Check for AuthRocket style token
						logger.debug({
							description: 'User data available from token.',
							tokenData: this.token.data, type: typeof this.token.data,
							func: 'login', obj: 'Matter'
						});
						if (this.token.data.un) {
							logger.log({
								description: 'Token is AuthRocket format.',
								func: 'login', obj: 'Matter'
							});
							userAccount = {
								username: this.token.data.un,
								name: this.token.data.n || null,
								authrocketId: this.token.data.uid || null
							};
						} else {
							logger.debug({
								description: 'Token is default format.',
								func: 'login', obj: 'Matter'
							});
							//Default token style
							userAccount = this.token.data;
						}
					} else {
						logger.error({
							description: 'User data not available from response or token.',
							func: 'login', obj: 'Matter'
						});
						userAccount = {token: this.token.string};
					}
					//Set userdata to local storage
					this.storage.setItem(config.tokenUserDataName, userAccount);
					return userAccount;
				}
			})['catch']((errRes) => {
				logger.error({
					description: 'Error requesting login.',
					error: errRes, status: errRes.status,
					func: 'login', obj: 'Matter'
				});
				if (errRes.status == 409 || errRes.status == 400) {
					errRes = errRes.response.text;
				}
				return Promise.reject(errRes);
			});
		} else {
			//Provider login
			let auth = new ProviderAuth({provider: loginData, app: this});
			return auth.login().then((res) => {
				logger.info({
					description: 'Provider login successful.',
					provider: loginData, res,
					func: 'login', obj: 'Matter'
				});
				return res;
			});
		}
	}
	/** logout
	 * @description Log out of currently logged in user account
	 * @return {Promise}
	 * @example
	 * //Logout of currently logged in account
	 * matter.logout().then(function(loginRes){
	 *  console.log('Logged out successfully');
	 * }, function(err){
	 *  console.error('Error logging out:', err);
	 * });
	 */
	logout() {
		//TODO: Handle logging out of providers
		if (!this.isLoggedIn) {
			logger.warn({
				description: 'No logged in account to log out.',
				func: 'logout', obj: 'Matter'
			});
			return Promise.reject({
				message: 'No logged in account to log out.',
				status: 'NULL_ACCOUNT'
			});
		}
		return request.put(this.endpoint + '/logout').then((response) => {
			logger.info({
				description: 'Logout successful.',
				response: response, func: 'logout', obj: 'Matter'
			});
			this.currentUser = null;
			this.token.delete();
			return response;
		})['catch']((errRes) => {
			logger.error({
				description: 'Error requesting log out: ',
				error: errRes, func: 'logout', obj: 'Matter'
			});
			this.storage.removeItem(config.tokenUserDataName);
			this.token.delete();
			return Promise.reject(errRes);
		});
	}
	providerSignup(providerData) {
		const { provider, code } = providerData;
		if(!provider){
			return Promise.reject('Provider name is required to signup.');
		}
		if(!code){
			return Promise.reject('Provider code or token is required to signup.');
		}
		let auth = new ProviderAuth({provider, app: this});
		return auth.accountFromCode(code).then(res => {
			logger.info({
				description: 'Provider login successful.',
				providerData, res,
				func: 'providerSignup', obj: 'Matter'
			});
			return res;
		}, error => {
			logger.error({
				description: 'Provider signup error.', error,
				func: 'providerSignup', obj: 'Matter'
			});
			return Promise.reject(error);
		});
	}
	/** getCurrentUser
	 * @return {Promise}
	 * @example
	 * //Logout of currently logged in account
	 * matter.getCurrentUser().then(function(currentAccount){
	 *  console.log('Currently logged in account:', currentAccount);
	 * }, function(err){
	 *  console.error('Error logging out:', err);
	 * });
	 */
	getCurrentUser() {
		if (this.currentUser) {
			logger.debug({
				description: 'Current is already available. Returning user.',
				func: 'currentUser', obj: 'Matter'
			});
			return Promise.resolve(this.currentUser);
		}
		if (!this.isLoggedIn) {
			logger.debug({
				description: 'Current user is null.',
				func: 'currentUser', obj: 'Matter'
			});
			return Promise.resolve(null);
		}
		return request.get(this.endpoint + '/user').then((response) => {
			//TODO: Save user information locally
			logger.log({
				description: 'Current User Request responded.',
				responseData: response, func: 'currentUser', obj: 'Matter'
			});
			this.currentUser = response;
			return response;
		})['catch']((errRes) => {
			if (errRes.status == 401) {
				logger.warn({
					description: 'Called for current user without token.',
					error: errRes, func: 'currentUser', obj: 'Matter'
				});
				token.delete();
				return Promise.resolve(null);
			}
			logger.error({
				description: 'Error requesting current user.',
				error: errRes, func: 'currentUser', obj: 'Matter'
			});
			return Promise.reject(errRes);
		});
	}
	/** updateAccount
	 * @param {Object} updateData - Data to update within profile (only provided data will be modified).
	 * @return {Promise}
	 * @example
	 * //Update current account's profile
	 * matter.updateAccount().then(function(updatedAccount){
	 *  console.log('Currently logged in account:', updatedAccount);
	 * }, function(err){
	 *  console.error('Error updating profile:', err);
	 * });
	 */
	updateAccount(updateData) {
		if (!this.isLoggedIn) {
			logger.error({
				description: 'No current user profile to update.',
				func: 'updateAccount', obj: 'Matter'
			});
			return Promise.reject({
				message: 'Must be logged in to update account.'
			});
		}
		if (!updateData) {
			logger.error({
				description: 'Data is required to update profile.',
				func: 'updateAccount', obj: 'Matter'
			});
			return Promise.reject({
				message: 'Data required to update account.',
				status: 'NULL_DATA'
			});
		}
		//Send update request
		return request.put(this.urls.update, updateData).then((response) => {
			logger.info({
				description: 'Update profile request responded.',
				responseData: response, func: 'updateAccount', obj: 'Matter'
			});
			this.currentUser = response;
			return response;
		})['catch']((errRes) => {
			logger.error({
				description: 'Error requesting current user.',
				error: errRes, func: 'updateAccount', obj: 'Matter'
			});
			return Promise.reject(errRes);
		});
	}
	/** uploadImage
	 * @description Upload image to Tessellate
	 * @param {Object} file - File object to upload
	 * @return {Promise}
	 * @example
	 * //Upload image to tessellate
	 * matter.uploadImage(file).then(function(imgUrl){
	 *  console.log('Currently logged in account:', imgUrl);
	 * }, function(err){
	 *  console.error('Error uploading image:', err);
	 * });
	 */
	uploadImage(fileData) {
		if (!this.isLoggedIn) {
			logger.error({
				description: 'Must be logged in to upload an image.',
				func: 'uploadImage', obj: 'Matter'
			});
			return Promise.reject({
				message: 'Must be logged in to upload image.'
			});
		}
		if (!fileData) {
			logger.error({
				description: 'Data is required to update profile.',
				func: 'uploadImage', obj: 'Matter'
			});
			return Promise.reject({
				message: 'Data required to update profile.',
				status: 'NULL_DATA'
			});
		}
		//Send update request
		const uploadUrl = `${this.endpoint}/user/${this.token.data.username}`;
		return request.put(this.urls.upload, fileData).then((response) => {
			logger.info({
				description: 'Upload image request responded.',
				responseData: response, func: 'uploadImage', obj: 'Matter'
			});
			this.currentUser = response;
			return response;
		})['catch']((errRes) => {
			logger.error({
				description: 'Error requesting current user.',
				error: errRes, func: 'uploadImage', obj: 'Matter'
			});
			return Promise.reject(errRes);
		});
	}
	/** uploadAccountImage
	 * @description Upload image and add url to currently logged in account
	 * @param {Object} file - File object to upload
	 * @return {Promise}
	 * @example
	 * //Upload image and set it to account
	 * matter.uploadAccountImage(file).then(function(updatedAccount){
	 *  console.log('Account with image:', updatedAccount);
	 * }, function(err){
	 *  console.error('Error uploading account image:', err);
	 * });
	 */
	uploadAccountImage(fileData) {
		return this.uploadImage(fileData).then((imgUrl) => {
			return this.updateAccount({image:{url: imgUrl}});
		});
	}
	/** changePassword
	 * @param {String} updateData New password for account.
	 * @return {Promise}
	 * @example
	 * //Update current account's password
	 * var newPassword = 'asdfasdfasdf';
	 * matter.changePassword(newPassword).then(function(updatedAccount){
	 *  console.log('Currently logged in account:', updatedAccount);
	 * }, function(err){
	 *  console.error('Error changing password:', err);
	 * });
	 */
	changePassword(newPassword) {
		if (!this.isLoggedIn) {
			logger.error({
				description: 'No current user profile for which to change password.',
				func: 'changePassword', obj: 'Matter'
			});
			return Promise.reject({
				message: 'Must be logged in to change password.'
			});
		}
		//Send update request
		return request.put(this.urls.changePassword, newPassword).then((response) => {
			logger.log({
				description: 'Update password request responded.',
				responseData: response, func: 'changePassword', obj: 'Matter'
			});
			return response;
		})['catch']((errRes) => {
			logger.error({
				description: 'Error requesting password change.',
				error: errRes, func: 'changePassword', obj: 'Matter'
			});
			return Promise.reject(errRes);
		});
	}
	/** recoverAccount
	 * @param {String} updateData New password for account.
	 * @return {Promise}
	 * @example
	 * //Recover current users password
	 * matter.recoverAccount().then(function(updatedAccount){
	 *  console.log('Currently logged in account:', updatedAccount);
	 * }, function(err){
	 *  console.error('Error updating profile:', err);
	 * });
	 */
	recoverAccount(accountData) {
		if (!accountData || (!isString(accountData) && !isObject(accountData))) {
			logger.error({
				description: 'Account data is required to recover an account.',
				func: 'recoverAccount', obj: 'Matter'
			});
			return Promise.reject({message: 'Account data is required to recover an account.'});
		}
		let account = {};
		if (isString(accountData)) {
			account = accountData.indexOf('@') !== -1 ? {email: accountData} : {username: accountData};
		} else {
			account = accountData;
		}
		logger.debug({
			description: 'Requesting recovery of account.', account,
			func: 'recoverAccount', obj: 'Matter'
		});
		//Send update request
		return request.post(this.urls.recover, account).then((response) => {
			logger.info({
				description: 'Recover password request responded.',
				response, func: 'recoverAccount', obj: 'Matter'
			});
			return response;
		})['catch']((errRes) => {
			logger.error({
				description: 'Error requesting password recovery.',
				error: errRes, func: 'recoverAccount', obj: 'Matter'
			});
			return Promise.reject(errRes);
		});
	}

	/** Save current user (handled automatically by default)
	 * @param {Object} userData - Account data to set for current user
	 * @example
	 * //Save account response to current user
	 * matter.currentUser = {username: 'testuser1', email: 'test@email.com'};
	 * console.log('New current user set:', matter.currentUser);
	 */
	set currentUser(userData) {
		logger.debug({
			description: 'Current User set.', user: userData,
			func: 'currentUser', obj: 'Matter'
		});
		this.storage.setItem(config.tokenUserDataName, userData);
	}
  /** Get currently logged in user or returns null
   * @return {Object|null}
   * @example
   * //Return account if logged in
   * if(matter.isLoggedIn){
   * console.log('Current user account: ', matter.currentUser);
   * } else {
   * console.log('No current user. Current user: ', matter.currentUser)
   * }
   * matter.currentUser
   * console.log('New current user set:', matter.currentUser);
   */
	get currentUser() {
		if (this.storage.getItem(config.tokenUserDataName)) {
			return this.storage.getItem(config.tokenUserDataName);
		} else {
			return null;
		}
	}
	/* Utility to handle safley writing to localStorage, sessionStorage, and cookies
	 * @return {Object}
	 */
	get storage() {
		return envStorage;
	}
	/** Utility to handle token writing/deleting/decoding
	 * @return {Object}
	 */
	get token() {
		return token;
	}
	/** Utils placed in base library
	 * @return {Object}
	 */
	get utils() {
		return {logger: logger, request: request, storage: envStorage, dom: dom};
	}

	/** Check that user is in a single group or in all of a list of groups
	 * @param {Array} checkGroups - List of groups to check for account membership
	 * @return {Boolean}
	 * @example
	 * //Check for group membership
	 * var isBoth = ;
	 * if(matter.isInGroup('admins')){
	 * console.log('Current account is an admin!');
	 * } else {
	 * console.warn('Current account is not an admin.');
	 * }
	 */
	isInGroup(checkGroups) {
		if (!this.isLoggedIn) {
			logger.error({
				description: 'No logged in user to check for groups.',
				func: 'isInGroup', obj: 'Matter'
			});
			return false;
		}
		if (!checkGroups) {
			logger.log({
				description: 'Invalid group(s).',
				func: 'isInGroup', obj: 'Matter'
			});
			return false;
		}
		//Check if user is
		if (isString(checkGroups)) {
			let groupName = checkGroups;
			//Single role or string list of roles
			let groupsArray = groupName.split(',');
			if (groupsArray.length > 1) {
				//String list of groupts
				logger.info({
					description: 'String list of groups.', list: groupsArray,
					func: 'isInGroup', obj: 'Matter'
				});
				return this.isInGroups(groupsArray);
			} else {
				//Single group
				let groups = this.token.data.groups || [];
				logger.log({
					description: 'Checking if user is in group.',
					group: groupName, userGroups: this.token.data.groups,
					func: 'isInGroup', obj: 'Matter'
				});
				return any(groups, (group) =>  {
					return groupName == group.name;
				});
			}
		} else if (isArray(checkGroups)) {
			//Array of groups/roles
			//Check that user is in every group
			logger.info({
				description: 'Array of groups.', list: checkGroups,
				func: 'isInGroup', obj: 'Matter'
			});
			return this.isInGroups(checkGroups);
		} else {
			return false;
		}
	}
	/** Check that user is in all of a list of groups
	 * @param {Array|String} checkGroups - List of groups to check for account membership
	 * @return {Boolean}
	 * @example
	 * //Check for group membership
	 * var isBoth = matter.isInGroups(['admins', 'users']);
	 * if(isBoth){
	 * console.log('Current account is both an admin and a user');
	 * } else {
	 * console.warn('Current account is not both an admin and a user')
	 * }
	 *
	 */
	isInGroups(checkGroups) {
		if (!this.isLoggedIn) {
			logger.log({
				description: 'No logged in user to check.',
				func: 'isInGroups', obj: 'Matter'
			});
			return false;
		}
		if (!checkGroups) {
			logger.log({
				description: 'Invalid group(s).',
				func: 'isInGroup', obj: 'Matter'
			});
			return false;
		}
		//Check if user is in any of the provided groups
		if (isArray(checkGroups)) {
			return every(checkGroups.map((group) => {
				if (isString(group)) {
					//Group is string
					return this.isInGroup(group);
				} else {
					//Group is object
					if (has(group, 'name')) {
						return this.isInGroup(group.name);
					} else {
						logger.error({
							description: 'Invalid group object.',
							group: group, func: 'isInGroups', obj: 'Matter'
						});
						return false;
					}
				}
			}), true);
		} else if (isString(checkGroups)) {
			//TODO: Handle spaces within string list
			let groupsArray = checkGroups.split(',');
			if (groupsArray.length > 1) {
				return this.isInGroups(groupsArray);
			}
			return this.isInGroup(groupsArray[0]);
		} else {
			logger.error({
				description: 'Invalid groups list.',
				func: 'isInGroups', obj: 'Matter'
			});
			return false;
		}
	}
}
