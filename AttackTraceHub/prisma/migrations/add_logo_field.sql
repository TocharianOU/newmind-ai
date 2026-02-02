-- Add logo field to MCPServer table
ALTER TABLE `MCPServer` 
  ADD COLUMN `logo` VARCHAR(500) NULL AFTER `isActive`;

-- Update existing records with logo paths based on banner paths
UPDATE `MCPServer` 
SET `logo` = REPLACE(`banner`, 'logo-240.svg', 'logo-48.svg')
WHERE `banner` IS NOT NULL AND `banner` LIKE '%/logo-240.svg';
