module.exports.AuthServer = {
	secret: 'JSONWebTokenSecret',
	host: 'localhost',
	port: '3002',
	senecaPort: 8002,
	pins: {
		login: {
			role: 'auth',
			cmd: 'login'
		},
		validate: {
			role: 'auth',
			cmd: 'validate'
		}
	}
}