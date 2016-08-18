'use strict'

const Hapi = require('hapi'),
	AuthClient = require('../lib'),
	Seneca = require('seneca')(),
	Config = require('../config/config'),
	request = require('request');

describe('register()', () => {
	var server;

	beforeEach(() => {
		server = new Hapi.Server();
		server.connection({ port: 3000 });
	});

	afterEach(() => {
		server.stop();
	});

	it('will return a 401 error when not authenticated', (done) => {
		server.register({ register: AuthClient }, (err) => {
			server.route({
				method: 'GET',
				path: '/restricted',
				config: {
					auth: 'jwt'
				},
				handler: function(request, reply) {
					reply({ success: true })
					          .header("Authorization", request.headers.authorization);
				}
			});
		});

		server.start((err) => {
			expect(err).not.toBeDefined();
		});

		// Request without headers
		request.get('http://localhost:3000/restricted', (err, response, body) => {
			expect(response.statusCode).toBe(401);

			// Request with authorization refToken header
			var options = {
				url: 'http://localhost:3000/restricted',
				headers: {
					'authorization': {
						'refToken': 'invalid token'
					}
				}
			}
			request.get(options, (err, response, body) => {
				expect(response.statusCode).toBe(401);
				done();
			});
		});
	});

	it('will return 200 if no auth is required', (done) => {
		server.register({ register: AuthClient }, (err) => {
			server.route({
				method: 'GET',
				path: '/unrestricted',
				handler: function(request, reply) {
					reply({ success: true })
					          .header("Authorization", request.headers.authorization);
				}
			});
		});
		
		server.start((err) => {
			expect(err).not.toBeDefined();
		});

		request.get('http://localhost:3000/unrestricted', (err, response, body) => {
			expect(response.statusCode).toBe(200);
			done();
		});
	});

	it('will return 200 on successful authentication', (done) => {

		// Authentication Server must be running at port 3002 using TestDao. There's probably a better way to test this while reducing dependencies. Probably a mock of some sort.
		
		var client = Seneca.client({
			type: 'http',
				port: Config.AuthServer.senecaPort,
				host: Config.AuthServer.host,
				pin: Config.AuthServer.pins.login
		}).client({
				type: 'http',
				port: Config.AuthServer.senecaPort,
				host: Config.AuthServer.host,
				pin: Config.AuthServer.pins.validate
		});

		server.register({ register: AuthClient }, (err) => {
			server.route({
				method: 'GET',
				path: '/restricted',
				handler: function(request, reply) {
					var message = Config.AuthServer.pins.validate;
					message.referenceToken = request.headers.referencetoken;
					client.act(message, (err, result) => {
						expect(err).toBeNull();
						expect(result.identityToken).toBeDefined();
						reply(result);
					});
				}
			});
		});
		
		server.start((err) => {
			expect(err).not.toBeDefined();
		});


		// TODO: When AuthServer updates login method to require a hashed password in the payload, this test will need to replace the password supplied
		client.act({
			username: 'jsmith',
			password: 'password',
			role: 'auth',
			cmd: 'login'
		}, (err, response) => {
			expect(err).toBeNull();

			var options = {
				url: 'http://localhost:3000/restricted',
				headers: {
					'referencetoken': response.referenceToken
				}
			}
			request.get(options, (err, response, body) => {
				expect(response.statusCode).toBe(200);
				console.log(body);
				done();
			});
		});
	});
});

