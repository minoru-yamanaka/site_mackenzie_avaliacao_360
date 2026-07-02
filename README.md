# Portal de Envio e Gerenciamento de Atividades

Aplicação web completa para envio, avaliação e exportação de atividades com 3 níveis de acesso: Aluno, Professor e Admin.

## Tecnologias Utilizadas
- **Backend:** Node.js, Express, Sequelize (ORM), Multer (Uploads), JWT, Bcrypt.
- **Frontend:** Vanilla HTML, CSS3, JavaScript.
- **Banco de Dados:** PostgreSQL.

## Como rodar o projeto

### 1. Pré-requisitos
- Node.js (v14+ recomendado)
- PostgreSQL instalado e rodando.

### 2. Configuração do Banco de Dados
1. Crie um banco de dados no PostgreSQL (por exemplo, `academico_db`).
2. Abra o arquivo `.env` na raiz do projeto e configure suas credenciais (usuário e senha do banco).
```env
PORT=3000
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=root
DB_NAME=numq_db
DB_DIALECT=postgres
JWT_SECRET=super_secret_jwt_key_12345
```

### 3. Instalar Dependências
No terminal, dentro da pasta do projeto, execute:
```bash
npm install
```

### 4. Executar o Servidor
Execute o comando abaixo. O Sequelize irá automaticamente criar todas as tabelas necessárias no banco de dados e inserir o primeiro administrador.
```bash
node server.js
```

Se preferir criar as tabelas manualmente, você pode utilizar o conteúdo do arquivo `database.sql` fornecido.

### 5. Acessos Iniciais
- **Área do Aluno (Envio):** Acesse `http://localhost:3000`
- **Área Restrita (Login Docente/Admin):** Acesse `http://localhost:3000/login.html`
  - **Login Admin Padrão:** `admin@sistema.com`
  - **Senha Admin Padrão:** `admin123`

### 6. Exportação para Excel
No Dashboard do Professor/Admin, existe um botão "Exportar Excel" que fará o download de uma planilha `.xlsx` com todas as submissões visíveis para aquele usuário.

<!-- Banco de dados MySQL u952185621_academico_db
Usuário MySQL u952185621_admin
Senha SenhaMedicina2026

PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=academico_db
DB_DIALECT=mysql
JWT_SECRET=super_secret_jwt_key_12345

# DB_HOST=127.0.0.1
# DB_USER=u952185621_admin
# DB_PASSWORD=SenhaMedicina2026
# DB_NAME=u952185621_academico_db
# DB_DIALECT=mysql
# JWT_SECRET=super_secret_jwt_key_12345 -->
