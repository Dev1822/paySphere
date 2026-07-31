const fs = require('fs');
const path = require('path');

const dashPath = path.join(__dirname, 'frontend', 'src', 'pages', 'Dashboard.jsx');
let dashCode = fs.readFileSync(dashPath, 'utf8');

if (!dashCode.includes('import Approvals from')) {
  dashCode = dashCode.replace(
    /import EmployeeCard from '\.\.\/components\/EmployeeCard';/,
    `import EmployeeCard from '../components/EmployeeCard';\nimport Approvals from './Approvals';`
  );

  dashCode = dashCode.replace(
    /\{activePage === 'Dashboard' \? \(/,
    `{activePage === 'Approvals' ? (\n          <Approvals />\n        ) : activePage === 'Dashboard' ? (`
  );
  
  fs.writeFileSync(dashPath, dashCode);
  console.log("Updated Dashboard.jsx with Approvals import");
}
