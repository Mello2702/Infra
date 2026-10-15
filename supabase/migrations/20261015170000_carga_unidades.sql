-- Carga inicial de unidades, transcrita da planilha enviada pelo usuário em
-- 15/10/2026 (nome fantasia, razão social, UGE, endereço, cidade, UF).
-- Unidades já cadastradas com o mesmo nome não são alteradas.

insert into public.unidades (nome, razao_social, uge, endereco, cidade, uf) values
  ('Arnaldo Pezzuti', 'Centro Especializado em Reabilitação Doutor Arnaldo Pezzuti Cavalcanti', '090175', 'Rod. Candido Rego Chaves, Km 3,5', 'Mogi das Cruzes', 'SP'),
  ('Cachoeirinha', 'Hospital Geral de Vila Nova Cachoeirinha', '090154', 'Avenida Deputado Emílio Carlos, 3000', 'São Paulo', 'SP'),
  ('Cândido Fontoura', 'Hospital Infantil Cândido Fontoura', '090169', 'Rua Siqueira Bueno, 1757', 'São Paulo', 'SP'),
  ('Cantídio de Moura Campos', 'Centro de Atenção Integral à Saúde Professor Cantídio de Moura Campos', '090145', 'Avenida José Ítalo Bacchi, s/nº', 'Botucatu', 'SP'),
  ('Casa Branca', 'Centro de Reabilitação de Casa Branca', '090146', 'Rodovia SP-340, Km 238', 'Casa Branca', 'SP'),
  ('Clemente Ferreira', 'Centro de Atenção a Saúde Clemente Ferreira - Lins', '090147', 'Estrada Lins-Guaiçara, km 4 - Caixa Postal 151', 'LINS', 'SP'),
  ('CSI - PINHEIROS', 'CSI - PINHEIROS', null, 'Rua Ferreira de Araújo, nº 789 - Pinheiros', 'São Paulo', 'SP'),
  ('CSS', 'Coordenadoria de Serviços de Saúde', '090148', 'Avenida Doutor Arnaldo, 351 - 4º Andar - Sala 406', 'São Paulo', 'SP'),
  ('Dante', 'Instituto Dante Pazzanese de Cardiologia', '090181', 'Avenida Dante Pazzanese, 500', 'São Paulo', 'SP'),
  ('DGAC', 'Depto. Gerenc. Ambulatorial da Capital', '090149', 'Rua Leopoldo Miguez, 327', 'São Paulo', 'SP'),
  ('Emílio Ribas', 'Instituto de Infectologia Emílio Ribas', '090183', 'Avenida Dr. Arnaldo, 165', 'São Paulo', 'SP'),
  ('Ferraz de Vasconcelos', 'Hospital Regional de Ferraz de Vasconcelos', '090166', 'Rua Princesa Isabel, 276 Vila Correia', 'Ferraz de Vasconcelos', 'SP'),
  ('GRAU', 'Grupo de Resgate - GRAU', '090200', 'Rua Clovis Bevilacqua, 421', 'São Paulo', 'SP'),
  ('Guilherme Alvaro', 'Hospital Guilherme Alvaro', '090141', 'Rua Oswaldo Cruz, 197', 'Santos', 'SP'),
  ('Heliópolis', 'Hospital Heliópolis UGA I', null, 'Rua Cônego Xavier, 276 - Sacomã', 'São Paulo', 'SP'),
  ('Hospital Francisco Ribeiro Arantes', 'Hospital Estadual Especializado em Reabilitação Francisco Ribeiro Arantes', '090203', 'Rodovia Waldomiro Correia de Camargo, km 63', 'Itu', 'SP'),
  ('Hospital Regional de Osasco', 'Hospital Regional "Dr. Vivaldo Martins Simões" - Osasco', '090167', 'Rua Ary Barroso, 355', 'Osasco', 'SP'),
  ('Instituto Clemente Ferreira', 'Instituto Clemente Ferreira', '090190', 'Rua da Consolação 717', 'São Paulo', 'SP'),
  ('Instituto Lauro de Souza Lima', 'Instituto Lauro de Souza Lima', '090182', 'Rodovia Comandante João Ribeiro de Barros km 225/226', 'Bauru', 'SP'),
  ('Interlagos', 'Hospital Maternidade “Waldemar Seyssel – Arrelia Interlagos”', '090168', 'Rua Leonor Alvin, 311', 'São Paulo', 'SP'),
  ('IPGG', 'Instituto Paulista de Geriatria e Gerontologia "José Ermírio de Moraes"', '090187', 'Praça Padre Aleixo Monteiro Mafra, 34', 'São Paulo', 'SP'),
  ('Juquery', 'Complexo Hospitalar Juquery', null, 'Avenida dos Coqueiros, 300', 'Franco da Rocha', 'SP'),
  ('Leonor', 'Hospital Maternidade Leonor Mendes de Barros (UGA-IV)', '090163', 'Avenida Celso Garcia, 2477', 'São Paulo', 'SP'),
  ('Mandaqui', 'Conjunto Hospitalar do Mandaqui Bispa Keila Campos Costa Ferreira', '090172', 'Rua Voluntários da Pátria, 4301', 'São Paulo', 'SP'),
  ('Maternidade Franco da Rocha', 'Complexo Hospitalar do Juquery', '090165', 'Avenida dos Coqueiros, 300', 'Franco da Rocha', 'SP'),
  ('Padre Bento', 'Complexo Hospitalar Padre Bento', '090171', 'Avenida Emílio Ribas, 1.573', 'Guarulhos', 'SP'),
  ('Pinel', 'Centro de Atenção Integrada a Saúde Mental Philippe Pinel', '090173', 'Avenida Raimundo Pereira de Magalhães, 5214', 'São Paulo', 'SP'),
  ('Promissão', 'Hospital Geral de Promissão', '090118', 'Avenida General Eurico Gaspar Dutra, 620', 'Promissão', 'SP'),
  ('Regional Sul', 'Hospital Regional Sul', '090157', 'Rua General Roberto Alves de Carvalho Filho, 270', 'São Paulo', 'SP'),
  ('Santa Rita', 'Centro de Atenção Integral a Saúde de Santa Rita', null, 'Avenida Padre Pio Corso, 1523', 'Santa Rita Do Passa Quatro', 'SP'),
  ('São Mateus', 'Hospital Geral de São Mateus', '090159', 'R. Ângelo de Cândia, 540/541', 'São Paulo', 'SP')
on conflict (nome) do nothing;
