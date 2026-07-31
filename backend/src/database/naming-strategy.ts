import { DefaultNamingStrategy, NamingStrategyInterface, Table } from 'typeorm';
import { snakeCase } from './snake-case.util';

export class SnakeCaseNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(className: string, customName?: string): string {
    return customName ? customName : snakeCase(className);
  }

  /**
   * The base implementations of these three hash the table+column names
   * into an opaque `FK_<hash>`/`UQ_<hash>`/`IDX_<hash>` name. Every
   * hand-written migration in this project instead names these
   * `<PREFIX>_<table>_<col1>_<col2>`, so without this override
   * `schema:log`/`synchronize` would see permanent "drift" — wanting to
   * drop and recreate every unnamed FK/unique-column/plain-column index
   * purely to rename it to the hash form. This does not change any actual
   * schema (constraint names in the DB already match this convention);
   * it only makes entity metadata agree with what migrations created.
   * Indices/constraints given an explicit name via the decorator (e.g.
   * `UQ_categories_slug_lower`, `IDX_categories_parent_id_display_order`)
   * bypass the naming strategy entirely and are unaffected by this.
   */
  foreignKeyName(tableOrName: Table | string, columnNames: string[]): string {
    return `FK_${this.getTableName(tableOrName)}_${columnNames.join('_')}`;
  }

  uniqueConstraintName(
    tableOrName: Table | string,
    columnNames: string[],
  ): string {
    return `UQ_${this.getTableName(tableOrName)}_${columnNames.join('_')}`;
  }

  indexName(tableOrName: Table | string, columnNames: string[]): string {
    return `IDX_${this.getTableName(tableOrName)}_${columnNames.join('_')}`;
  }

  columnName(
    propertyName: string,
    customName?: string,
    embeddedPrefixes: string[] = [],
  ): string {
    const name = embeddedPrefixes.concat(propertyName).join('_');
    return customName ? customName : snakeCase(name);
  }

  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  joinTableName(firstTableName: string, secondTableName: string): string {
    return snakeCase(`${firstTableName}_${secondTableName}`);
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snakeCase(`${tableName}_${columnName || propertyName}`);
  }
}
