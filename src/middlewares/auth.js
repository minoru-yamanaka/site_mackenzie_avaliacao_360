const jwt = require('jsonwebtoken');
const { User } = require('../models');

const verifyToken = async (req, res, next) => {
    let token = req.headers['authorization'];
    
    if (!token) {
        return res.status(403).json({ error: 'Nenhum token fornecido.' });
    }

    if (token.startsWith('Bearer ')) {
        token = token.slice(7, token.length).trimLeft();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verifica se o usuário ainda está ativo no banco
        const user = await User.findByPk(decoded.id);
        
        if (!user || user.is_active === false) {
            return res.status(403).json({ error: 'Sua conta está bloqueada ou não existe.' });
        }

        req.userId = decoded.id;
        req.userRole = decoded.role;
        next();
    } catch (err) {
        console.error('Erro na verificação do token:', err);
        return res.status(401).json({ error: 'Falha na autenticação do token ou conta inválida.' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Requer privilégios de administrador.' });
    }
    next();
};

const isProfessor = (req, res, next) => {
    if (req.userRole !== 'professor' && req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Requer privilégios de professor.' });
    }
    next();
};

module.exports = {
    verifyToken,
    isAdmin,
    isProfessor
};
