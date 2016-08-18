'use strict'

const Hapi = require('hapi'),
	AuthClient = require('../lib'),
	Seneca = require('seneca')(),
	Config = require('../config/config'),
	request = require('request'),
	jwt = require('jsonwebtoken');

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
				pin: Config.AuthServer.pins.login,
				protocol: 'https'
		}).client({
				type: 'http',
				port: Config.AuthServer.senecaPort,
				host: Config.AuthServer.host,
				pin: Config.AuthServer.pins.validate,
				protocol: 'https'
		});

		server.register({ register: AuthClient }, (err) => {
			server.route({
				method: 'POST',
				path: '/login',
				handler: function(request, reply) {
					client.act({
						username: request.payload.username,
						password: request.payload.password,
						role: 'auth',
						cmd: 'login'	
					}, (err, response) => {
						expect(err).toBeNull();
						reply(response);
					});
				}
			});

			server.route({
				method: 'GET',
				path: '/restricted',
				config: {
					auth: 'jwt'
				},
				handler: function(request, reply) {
					if (request.auth.isAuthenticated) {
						reply({
							identityToken: request.auth.credentials.identityToken
						});
					} else {
						reply({ success: false });
					}
				}
			});
		});
		
		server.start((err) => {
			expect(err).not.toBeDefined();
		});


		// TODO: When AuthServer updates login method to require a hashed password in the payload, this test will need to replace the password supplied
		
		request.post('http://localhost:3000/login'
			, { 
				form: {
					username: 'jsmith',
					password: 'password'
				}
			}, (err, response, body) => {
				var body = JSON.parse(body);
				var options = {
					url: 'https://localhost:3000/restricted',
					headers: {
						'referencetoken': body.referenceToken
					}
				}
				request.get(options, (err, response, body) => {
					body = JSON.parse(body);
					expect(response.statusCode).toBe(200);
					expect(body.identityToken).toBeDefined();

					var decoded = jwt.verify(body.identityToken, Config.AuthServer.secret);
					expect(decoded.id).toBe(1);
					expect(decoded.username).toBe('jsmith');
					done();
				});
				
		});
		
	});

	it('will require all auth on all routes if default is set to true', (done) => {
		server.register({ 
			register: AuthClient,
			options: {
				defaultOn: true
			} 
		}, (err) => {
			
			server.route({
				method: 'GET',
				path: '/path1',
				handler: function(request, reply) {
					reply({ success: true })
				}
			});

			server.route({
				method: 'GET',
				path: '/path2',
				handler: function(request, reply) {
					reply({ success: true })
				}
			});
		});

		server.start((err) => {
			expect(err).not.toBeDefined();
		});

		request.get('http://localhost:3000/path1', (err, response, body) => {
			expect(response.statusCode).toBe(401);
			
			request.get('http://localhost:3000/path2', (err, response, body) => {
				expect(response.statusCode).toBe(401);
				done();
			})
		})
	});
});

