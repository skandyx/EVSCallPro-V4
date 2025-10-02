// @ts-nocheck
describe('Contact List Visual Deduplication', () => {
    beforeEach(() => {
        // Log in as an admin/supervisor user to access campaigns
        cy.visit('/');
        cy.get('input[name="loginId"]').type('9000'); // Use admin credentials from seed
        cy.get('input[name="password"]').type('9000');
        cy.get('button[type="submit"]').click();

        // Wait for main app to load
        cy.get('aside').should('be.visible');
    });

    it('should display the correct number of unique contacts without duplicates', () => {
        // Navigate to the Outbound Campaigns Manager
        cy.get('aside button').contains('Sortant').click();
        cy.get('button').contains('Campagnes Sortantes').click();

        // Find the campaign and click on it. We'll click the first one available.
        cy.get('tbody tr:first-child td:first-child button').click();

        // Now in CampaignDetailView. The user expects the total count to be 192.
        // Check the tab for the correct total count.
        cy.get('button').contains('Contacts (192)').should('be.visible');

        // As per the user's validation criteria, check the number of rendered rows.
        // This assumes a test scenario where pagination is not active or all items are on one page.
        cy.get('tbody tr').should('have.length', 192);
    });
});
