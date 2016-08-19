const Config = require('../config/config'),
	Boom = require('boom'),
	Seneca = require('seneca')(),
	jwt = require('jsonwebtoken');

exports.register = function(server, options, next) {
	server.auth.scheme('jwt', scheme);

	server.auth.strategy('jwt', 'jwt', options.defaultOn, {
		key: Config.AuthServer.secret
	});

	next();
}

exports.register.attributes = {
	pkg: require('../package.json')
}

exports.verify = function(token) {
	try {
		var decoded = jwt.verify(token, Config.AuthServer.secret);
		return decoded;
	} catch (err) {
		return err;
	}
}

const scheme = function(server, options) {
	return {
		authenticate: function(request, reply) {
			if (request.auth.isAuthenticated) {
				reply.continue({ credentials });
			}

			var refToken = request.headers.referencetoken;

			if (!refToken) {
				return reply(Boom.unauthorized('Could not authenticate request'));
			}

			Seneca.client({
				type: 'http',
				port: Config.AuthServer.senecaPort,
				host: Config.AuthServer.host,
				pin: Config.AuthServer.pins.validate
			}).act({
				role: 'auth',
				cmd: 'validate',
				referenceToken: refToken
			}, (err, result) => {
				if (err) {
					return reply(Boom.unauthorized('Could not authenticate request'));
				}
				reply.continue({ credentials: result });
			});
		}
	}
}