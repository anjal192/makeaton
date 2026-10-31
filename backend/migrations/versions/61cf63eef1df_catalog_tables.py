"""catalog tables

Revision ID: 61cf63eef1df
Revises: 42fdb5073311
Create Date: 2026-10-31 16:00:22.264935

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '61cf63eef1df'
down_revision: Union[str, Sequence[str], None] = '42fdb5073311'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('discounts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('code', sa.String(length=50), nullable=True),
    sa.Column('discount_type', sa.Enum('percent', 'fixed', name='discounttype', native_enum=False, length=20), nullable=False),
    sa.Column('value', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('start_date', sa.Date(), nullable=True),
    sa.Column('end_date', sa.Date(), nullable=True),
    sa.Column('min_amount', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('min_quantity', sa.Integer(), nullable=True),
    sa.Column('usage_limit', sa.Integer(), nullable=True),
    sa.Column('used_count', sa.Integer(), server_default='0', nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("discount_type <> 'percent' OR value <= 100", name='ck_discounts_percent_max'),
    sa.CheckConstraint('min_amount IS NULL OR min_amount >= 0', name='ck_discounts_min_amount'),
    sa.CheckConstraint('min_quantity IS NULL OR min_quantity >= 1', name='ck_discounts_min_qty'),
    sa.CheckConstraint('start_date IS NULL OR end_date IS NULL OR end_date >= start_date', name='ck_discounts_dates'),
    sa.CheckConstraint('usage_limit IS NULL OR usage_limit >= 1', name='ck_discounts_limit'),
    sa.CheckConstraint('usage_limit IS NULL OR used_count <= usage_limit', name='ck_discounts_used_max'),
    sa.CheckConstraint('used_count >= 0', name='ck_discounts_used_nonneg'),
    sa.CheckConstraint('value > 0', name='ck_discounts_value'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code')
    )
    op.create_table('plans',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('billing_period', sa.Enum('daily', 'weekly', 'monthly', 'yearly', name='billingperiod', native_enum=False, length=20), nullable=False),
    sa.Column('price', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('min_quantity', sa.Integer(), server_default='1', nullable=False),
    sa.Column('max_quantity', sa.Integer(), nullable=True),
    sa.Column('duration_cycles', sa.Integer(), nullable=True),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('duration_cycles IS NULL OR duration_cycles >= 1', name='ck_plans_duration'),
    sa.CheckConstraint('max_quantity IS NULL OR max_quantity >= min_quantity', name='ck_plans_max_qty'),
    sa.CheckConstraint('min_quantity >= 1', name='ck_plans_min_qty'),
    sa.CheckConstraint('price >= 0', name='ck_plans_price'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('products',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('sku', sa.String(length=64), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('base_price', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('base_price >= 0', name='ck_products_base_price'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('sku')
    )
    op.create_table('taxes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('rate_percent', sa.Numeric(precision=5, scale=2), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('rate_percent >= 0 AND rate_percent <= 100', name='ck_taxes_rate'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('product_variants',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('sku', sa.String(length=64), nullable=False),
    sa.Column('extra_price', sa.Numeric(precision=12, scale=2), server_default='0', nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('extra_price >= 0', name='ck_variants_extra_price'),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('product_id', 'name', name='uq_variant_product_name'),
    sa.UniqueConstraint('sku')
    )
    op.create_index(op.f('ix_product_variants_product_id'), 'product_variants', ['product_id'], unique=False)
    op.create_table('quotation_templates',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=150), nullable=False),
    sa.Column('plan_id', sa.Integer(), nullable=False),
    sa.Column('validity_days', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('quotation_template_lines',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('template_id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
    sa.ForeignKeyConstraint(['template_id'], ['quotation_templates.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_quotation_template_lines_template_id'), 'quotation_template_lines', ['template_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_quotation_template_lines_template_id'), table_name='quotation_template_lines')
    op.drop_table('quotation_template_lines')
    op.drop_table('quotation_templates')
    op.drop_index(op.f('ix_product_variants_product_id'), table_name='product_variants')
    op.drop_table('product_variants')
    op.drop_table('taxes')
    op.drop_table('products')
    op.drop_table('plans')
    op.drop_table('discounts')
