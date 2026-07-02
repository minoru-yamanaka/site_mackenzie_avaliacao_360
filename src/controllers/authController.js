const db = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await db.User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        if (user.is_active === false) {
            return res.status(403).json({ error: 'Este usuário está bloqueado e não pode acessar o sistema.' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro no servidor durante o login.' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const user = await db.User.findByPk(req.userId);
        
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        if (name) user.name = name;
        if (email) user.email = email;
        if (password && password.trim() !== '') {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();

        res.json({ 
            message: 'Perfil atualizado com sucesso!',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar perfil.' });
    }
};
