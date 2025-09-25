-- Add new fields to McpServer table for supporting stdio transport and additional metadata
ALTER TABLE `McpServer` 
  MODIFY COLUMN `transport` VARCHAR(50) DEFAULT 'stdio',
  ADD COLUMN `command` VARCHAR(200) NULL AFTER `transport`,
  ADD COLUMN `args` JSON NULL AFTER `command`,
  MODIFY COLUMN `url` VARCHAR(500) NULL,
  ADD COLUMN `env` JSON NULL AFTER `url`,
  ADD COLUMN `banner` VARCHAR(500) NULL AFTER `planRequired`,
  ADD COLUMN `document` TEXT NULL AFTER `banner`,
  ADD COLUMN `tokenCost` DOUBLE DEFAULT 0 AFTER `document`,
  ADD COLUMN `tokenRequired` DOUBLE DEFAULT 0 AFTER `tokenCost`,
  ADD COLUMN `tokenPriceUnit` VARCHAR(50) DEFAULT 'request' AFTER `tokenRequired`,
  ADD COLUMN `popular` BOOLEAN DEFAULT FALSE AFTER `tokenPriceUnit`,
  ADD COLUMN `new` BOOLEAN DEFAULT FALSE AFTER `popular`;

-- Update existing records to have proper transport type
UPDATE `McpServer` SET `transport` = 'stdio' WHERE `transport` = 'http';
