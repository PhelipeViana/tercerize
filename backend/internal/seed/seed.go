package seed

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"tercerize/backend/internal/totp"
)

// Ensure guarantees the Master account (phelipegabriel1988@gmail.com) with TOTP secret and initial multi-company data exist.
func Ensure(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var tenant1ID string
	err = tx.QueryRow(ctx, `SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1`).Scan(&tenant1ID)
	if err != nil {
		if err := tx.QueryRow(ctx,
			`INSERT INTO tenants (name, cnpj, owner_name, owner_email, active)
			 VALUES ('Tercerize Serviços & Facilities MT Ltda', '14.520.890/0001-77', 'Phelipe Viana', 'phelipegabriel1988@gmail.com', true)
			 RETURNING id`).Scan(&tenant1ID); err != nil {
			return fmt.Errorf("seed tenant 1: %w", err)
		}

		var tenant2ID string
		if err := tx.QueryRow(ctx,
			`INSERT INTO tenants (name, cnpj, owner_name, owner_email, active)
			 VALUES ('Alfa Engenharia & Manutenção Predial Ltda', '28.910.440/0001-03', 'Phelipe Viana', 'phelipegabriel1988@gmail.com', true)
			 RETURNING id`).Scan(&tenant2ID); err != nil {
			return fmt.Errorf("seed tenant 2: %w", err)
		}

		if err := seedTenant1Data(ctx, tx, tenant1ID); err != nil {
			return err
		}
		if err := seedTenant2Data(ctx, tx, tenant2ID); err != nil {
			return err
		}
	}

	// Ensure Master user exists with is_master = true and a valid Base32 TOTP secret
	masterSecret, err := totp.GenerateSecret()
	if err != nil {
		return fmt.Errorf("generate master totp secret: %w", err)
	}

	var masterID string
	err = tx.QueryRow(ctx,
		`INSERT INTO users (tenant_id, name, email, password_hash, role, is_master, totp_secret)
		 VALUES ($1, 'Phelipe Viana', 'phelipegabriel1988@gmail.com', '', 'developer', true, $2)
		 ON CONFLICT ((lower(email))) DO UPDATE
		 SET is_master = true,
		     name = 'Phelipe Viana',
		     totp_secret = CASE WHEN users.totp_secret = '' THEN EXCLUDED.totp_secret ELSE users.totp_secret END
		 RETURNING id`,
		tenant1ID, masterSecret).Scan(&masterID)
	if err != nil {
		return fmt.Errorf("seed master user: %w", err)
	}

	// Ensure every user without a TOTP secret receives one
	rows, err := tx.Query(ctx, `SELECT id FROM users WHERE totp_secret = ''`)
	if err == nil {
		var missingIDs []string
		for rows.Next() {
			var uid string
			if scanErr := rows.Scan(&uid); scanErr == nil {
				missingIDs = append(missingIDs, uid)
			}
		}
		rows.Close()
		for _, uid := range missingIDs {
			if sec, secErr := totp.GenerateSecret(); secErr == nil {
				_, _ = tx.Exec(ctx, `UPDATE users SET totp_secret = $1 WHERE id = $2`, sec, uid)
			}
		}
	}

	// Ensure all tenants have owner_user_id and default roles
	_, _ = tx.Exec(ctx,
		`UPDATE tenants
		 SET owner_name = CASE WHEN owner_name = '' THEN 'Phelipe Viana' ELSE owner_name END,
		     owner_email = CASE WHEN owner_email = '' THEN 'phelipegabriel1988@gmail.com' ELSE owner_email END,
		     owner_user_id = COALESCE(owner_user_id, $1)`, masterID)

	return tx.Commit(ctx)
}

func seedTenant1Data(ctx context.Context, tx pgx.Tx, tenantID string) error {
	var client1ID, client2ID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO clients (tenant_id, name, cnpj, contact)
		 VALUES ($1, 'Comércio e Serviços Mato Grosso Ltda', '12.345.678/0001-95', '(65) 3321-4050 • compras@comerciomt.com.br')
		 RETURNING id`, tenantID).Scan(&client1ID); err != nil {
		return err
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO clients (tenant_id, name, cnpj, contact)
		 VALUES ($1, 'Supermercado Bom Preço', '23.456.789/0001-95', '(65) 3624-8890 • ti@superbompreco.com.br')
		 RETURNING id`, tenantID).Scan(&client2ID); err != nil {
		return err
	}

	var contract1ID, contract2ID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO contracts (tenant_id, client_id, code, object, scope_notes, workstation, duration_months, monthly_value, status)
		 VALUES ($1, $2, '#CT-001', 'Manutenção Preventiva e Suporte Técnico',
		         'Prestação de serviços contínuos de suporte técnico, manutenção preventiva e alocação de equipe especializada.',
		         'Matriz Cuiabá • 4 Postos', 12, 18500.00, 'Ativo')
		 RETURNING id`, tenantID, client1ID).Scan(&contract1ID); err != nil {
		return err
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO contracts (tenant_id, client_id, code, object, scope_notes, workstation, duration_months, monthly_value, status)
		 VALUES ($1, $2, '#CT-002', 'Terceirização de Infraestrutura e Redes',
		         'Operação de cabeamento estruturado, switches corporativos e plantão técnico presencial.',
		         'Unidades Várzea Grande e Coxipó • 6 Postos', 24, 24900.00, 'Ativo')
		 RETURNING id`, tenantID, client2ID).Scan(&contract2ID); err != nil {
		return err
	}

	var emp1ID, emp2ID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO employees (tenant_id, contract_id, name, role_title, schedule, status)
		 VALUES ($1, $2, 'Carlos Silva', 'Técnico de Infraestrutura Sênior', 'Comercial 44h (08h às 18h)', 'Alocado')
		 RETURNING id`, tenantID, contract1ID).Scan(&emp1ID); err != nil {
		return err
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO employees (tenant_id, contract_id, name, role_title, schedule, status)
		 VALUES ($1, $2, 'Ana Souza', 'Especialista em Redes e Cabeamento', 'Escala 12x36 Diurno (07h às 19h)', 'Alocado')
		 RETURNING id`, tenantID, contract2ID).Scan(&emp2ID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO epi_deliveries (tenant_id, employee_id, epi_name, ca_number, delivered_at, expires_at, receipt_signed, signed_at, signed_by, evidence_code)
		 VALUES
		   ($1, $2, 'Capacete de Segurança Classe B c/ Jugular', 'CA-31469', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '335 days', true, now() - INTERVAL '30 days', 'Carlos Silva', 'TRM-31469A'),
		   ($1, $3, 'Luva Isolante de Proteção e Vaqueta', 'CA-19842', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '165 days', false, NULL, '', '')`,
		tenantID, emp1ID, emp2ID); err != nil {
		return err
	}

	var item1ID, item4ID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO inventory_items (tenant_id, sku, description, category, quantity, unit, unit_value, min_quantity)
		 VALUES ($1, 'CAB-UTP-CAT6', 'Cabo UTP Cat6 (Caixa 305m)', 'Material', 5, 'un.', 450.00, 2)
		 RETURNING id`, tenantID).Scan(&item1ID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO inventory_items (tenant_id, sku, description, category, quantity, unit, unit_value, min_quantity)
		 VALUES
		   ($1, 'CON-RJ45-100', 'Conector RJ45 Macho (Pacote com 100)', 'Material', 12, 'pct.', 35.50, 3),
		   ($1, 'SW-TP-8P', 'Switch Gigabit 8 Portas', 'Material', 8, 'un.', 180.00, 2)`,
		tenantID); err != nil {
		return err
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO inventory_items (tenant_id, sku, description, category, quantity, unit, unit_value, min_quantity)
		 VALUES ($1, 'FER-CERT-01', 'Certificador e Testador de Rede Fluke', 'Ferramenta', 3, 'un.', 1250.00, 1)
		 RETURNING id`, tenantID).Scan(&item4ID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO inventory_movements (tenant_id, item_id, employee_id, movement_type, previous_quantity, quantity, new_quantity, notes)
		 VALUES
		   ($1, $2, $3, 'Saída', 6, 1, 5, 'Aplicado na revisão de cabeamento da OS #OS-104'),
		   ($1, $4, $3, 'Cautela', 4, 1, 3, 'Termo de cautela de ferramenta assinado para atendimento em campo')`,
		tenantID, item1ID, emp1ID, item4ID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO service_orders (tenant_id, client_id, contract_id, employee_id, code, description, priority, status, scheduled_for)
		 VALUES
		   ($1, $2, $4, $6, '#OS-104', 'Revisão de cabeamento estruturado e switches', 'Alta', 'Em Execução', NULL),
		   ($1, $3, $5, $7, '#OS-105', 'Atendimento corretivo em ponto de rede', 'Normal', 'Agendada', now() + INTERVAL '1 day')`,
		tenantID, client1ID, client2ID, contract1ID, contract2ID, emp1ID, emp2ID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO financial_entries (tenant_id, contract_id, entry_type, description, amount, due_date, reconciliation_status)
		 VALUES
		   ($1, $2, 'Receita', 'Faturamento Mensal — Contrato #CT-001 (Comércio e Serviços MT)', 18500.00, CURRENT_DATE + INTERVAL '5 days', 'Conciliado'),
		   ($1, $3, 'Receita', 'Faturamento Mensal — Contrato #CT-002 (Supermercado Bom Preço)', 24900.00, CURRENT_DATE + INTERVAL '10 days', 'Pendente'),
		   ($1, $2, 'Despesa', 'Aquisição de Insumos de Rede (Cat6 / Conectores / EPIs)', 3420.00, CURRENT_DATE - INTERVAL '2 days', 'Conciliado')`,
		tenantID, contract1ID, contract2ID); err != nil {
		return err
	}

	return nil
}

func seedTenant2Data(ctx context.Context, tx pgx.Tx, tenantID string) error {
	var clientID, contractID, empID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO clients (tenant_id, name, cnpj, contact)
		 VALUES ($1, 'Hospital Santa Helena Cuiabá', '33.112.900/0001-80', '(65) 3055-1000 • engenharia@santahelena.com.br')
		 RETURNING id`, tenantID).Scan(&clientID); err != nil {
		return err
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO contracts (tenant_id, client_id, code, object, scope_notes, workstation, duration_months, monthly_value, status)
		 VALUES ($1, $2, '#CT-101', 'Manutenção Predial Elétrica e Climatização',
		         'Equipe residente para manutenção preventiva de quadros elétricos e chillers.',
		         'Bloco Cirúrgico e Internação', 36, 42000.00, 'Ativo')
		 RETURNING id`, tenantID, clientID).Scan(&contractID); err != nil {
		return err
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO employees (tenant_id, contract_id, name, role_title, schedule, status)
		 VALUES ($1, $2, 'Roberto Mendes', 'Eletricista de Manutenção Predial', 'Plantão 12x36 Noturno', 'Alocado')
		 RETURNING id`, tenantID, contractID).Scan(&empID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO service_orders (tenant_id, client_id, contract_id, employee_id, code, description, priority, status)
		 VALUES ($1, $2, $3, $4, '#OS-201', 'Inspeção termográfica no quadro geral de baixa tensão', 'Urgente', 'Em Execução')`,
		tenantID, clientID, contractID, empID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO financial_entries (tenant_id, contract_id, entry_type, description, amount, due_date, reconciliation_status)
		 VALUES ($1, $2, 'Receita', 'Medição Mensal — Contrato #CT-101 (Hospital Santa Helena)', 42000.00, CURRENT_DATE + INTERVAL '7 days', 'Conciliado')`,
		tenantID, contractID); err != nil {
		return err
	}
	return nil
}
